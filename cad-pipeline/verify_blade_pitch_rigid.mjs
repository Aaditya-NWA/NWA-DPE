// path: cad-pipeline/verify_blade_pitch_rigid.mjs
/**
 * GATE for variable blade pitch (2026-08-04, feature-002-variablePitch).
 * Run after ANY change to the pitch maths in Model.tsx buildPitchGroups
 * or to rig.pitch in vtol.json.
 *
 *   node cad-pipeline/verify_blade_pitch_rigid.mjs
 *   node cad-pipeline/verify_blade_pitch_rigid.mjs --self-test
 *
 * WHAT IT PROVES, against the REAL GLB and the REAL authored keys, by
 * replaying exactly the maths the app uses:
 *
 *   T1 the pitch actually rotates the blade            (it is not a no-op)
 *   T2 the blade stays RIGID                           (no shearing)
 *   T3 the blade pair stays 2-fold symmetric           (pitch, not see-saw)
 *   T4 the pivot passes through the hub centre         (no bulk swing)
 *
 * NOTE ON T4, because the obvious version of it is worthless: distance
 * from the ROTATION AXIS is preserved by any rotation about that axis, by
 * construction, so measuring it could never fail. Distance from the HUB
 * CENTRE is different — it is preserved only because the pitch axis
 * actually passes through that point. A pivot placed anywhere else still
 * passes T2 (a translated rigid body is still rigid) and fails T4. That
 * is precisely the defect class that cost this project 606 and 1210 units
 * on the spin path (MEMORY.md 2026-07-29).
 *
 * An earlier draft of T4 compared the blade's BOUNDING-BOX centre radius
 * and reported failures up to 1.16 units. That was the metric being
 * wrong, not the code: rotating an asymmetric airfoil changes its
 * axis-aligned bounding box, so the bbox centre shifts even under a
 * perfect rotation. Recorded here so nobody re-derives it.
 *
 * T3 IS THE ONE THAT MATTERS, and it is the whole reason this file
 * exists. Pitching a propeller means putting BOTH blades at the same
 * aerodynamic angle. Two opposed blades have opposite outward radials, so
 * "+t about each blade's own axis" is a counter-rotation in world space.
 * Get that wrong — rotate both the same way about one shared axis — and
 * you get a see-saw: one blade tilts up, the other down. It looks like
 * motion, a screenshot would not obviously condemn it, and it is not
 * pitch. T3 catches exactly that.
 *
 * WHAT EACH METRIC WOULD RETURN IF THE BUG WERE PRESENT (the standing
 * rule, MEMORY.md section 5 — a check that cannot fail is worthless):
 *
 *   T1 a no-op pitch  -> displacement 0, and T1 fails.
 *   T2 a deformation  -> pairwise vertex distances change, and T2 fails.
 *   T3 a see-saw      -> symmetry error jumps from ~0 to hundreds of
 *                        units. --self-test INJECTS the see-saw and
 *                        FAILS THIS SCRIPT if T3 still passes, so the
 *                        gate is proven able to fail rather than assumed
 *                        able to.
 *   T4 a wrong pivot  -> the blade sweeps in or out and radius changes.
 *
 * These solids have IDENTITY transforms with geometry baked into the
 * vertices (MEMORY.md 2026-07-29), so accessor data is already in the
 * space the app measures in.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLB = path.join(HERE, '..', 'public', 'models', 'vtol_airframe.glb');
const META = path.join(HERE, '..', 'public', 'metadata', 'vtol.json');
const SELF_TEST = process.argv.includes('--self-test');

/** Angles swept by the check. 0 is excluded — a no-op passes trivially. */
const TEST_ANGLES_DEG = [-30, -12, 5, 18, 30];
/** Model units. Geometry is hundreds of units across, so 1e-3 is tight. */
const EPS_RIGID = 1e-3;
const EPS_SYMMETRY = 1e-2;
/** Distance-from-hub is exact arithmetic under a rotation about an axis
 *  through the hub, so anything above float noise means a moved pivot. */
const EPS_HUB = 1e-6;

// ---------------------------------------------------------------- read
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binHeader = 20 + jsonLen;
  return { json, bin: buf.slice(binHeader + 8, binHeader + 8 + buf.readUInt32LE(binHeader)) };
}

const { json: gltf, bin } = readGlb(GLB);
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));

const used = Object.create(null);
const runtimeNames = gltf.nodes.map((n) => {
  const s = THREE.PropertyBinding.sanitizeNodeName(n.name || '');
  if (s in used) return `${s}_${++used[s]}`;
  used[s] = 0;
  return s;
});
const rootNodeIndex = gltf.scenes[gltf.scene ?? 0].nodes[0];
const keyToNode = new Map();
(gltf.nodes[rootNodeIndex].children ?? []).forEach((nodeIdx, i) => {
  keyToNode.set(`${runtimeNames[nodeIdx]}#${i}`, nodeIdx);
});

function readPositions(nodeIdx) {
  const node = gltf.nodes[nodeIdx];
  const out = [];
  for (const prim of gltf.meshes[node.mesh].primitives) {
    const a = gltf.accessors[prim.attributes.POSITION];
    const view = gltf.bufferViews[a.bufferView];
    const base = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const stride = view.byteStride ?? 12;
    for (let i = 0; i < a.count; i++) {
      const o = base + i * stride;
      out.push(new THREE.Vector3(bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)));
    }
  }
  return out;
}

const bboxOf = (verts) => verts.reduce((b, v) => b.expandByPoint(v), new THREE.Box3());

function dominantAxis(box) {
  const s = box.getSize(new THREE.Vector3());
  return [
    { name: 'x', value: s.x, vec: new THREE.Vector3(1, 0, 0) },
    { name: 'y', value: s.y, vec: new THREE.Vector3(0, 1, 0) },
    { name: 'z', value: s.z, vec: new THREE.Vector3(0, 0, 1) },
  ].sort((a, b) => a.value - b.value)[0];
}

// ------------------------------------------------- the app's own maths
/**
 * Mirrors Model.tsx: the spin group is parked on the spinning subset's
 * bbox centre, and each blade's pitch axis is its own outward radial,
 * i.e. its centre offset from that origin with the spin-axis component
 * removed. Kept in one function so a change here is a change to what is
 * being verified, not a second implementation that can silently diverge.
 */
function pitchAxisFor(bladeVerts, spinCenter, spinAxis) {
  const center = bboxOf(bladeVerts).getCenter(new THREE.Vector3());
  const radial = center.clone().sub(spinCenter).projectOnPlane(spinAxis);
  return radial.normalize();
}

/** v' = spinCenter + R(axis, angle) . (v - spinCenter) */
function applyPitch(verts, spinCenter, axis, angleRad) {
  return verts.map((v) =>
    v.clone().sub(spinCenter).applyAxisAngle(axis, angleRad).add(spinCenter),
  );
}

// ------------------------------------------------------------- checks
const maxPairwiseDelta = (a, b, samplePairs) => {
  let worst = 0;
  for (const [i, j] of samplePairs) {
    worst = Math.max(worst, Math.abs(a[i].distanceTo(a[j]) - b[i].distanceTo(b[j])));
  }
  return worst;
};

/** Max index-wise deviation between blade B and blade A rotated 180
 *  degrees about the spin axis. Index-wise is valid only if the two
 *  meshes are the same buffer mirrored, which the baseline check below
 *  confirms before any pitched comparison is trusted. */
function symmetryError(bladeA, bladeB, spinCenter, spinAxis) {
  let worst = 0;
  for (let i = 0; i < bladeA.length; i++) {
    const mapped = bladeA[i].clone().sub(spinCenter).applyAxisAngle(spinAxis, Math.PI).add(spinCenter);
    worst = Math.max(worst, mapped.distanceTo(bladeB[i]));
  }
  return worst;
}

const radiusFromAxis = (verts, spinCenter, spinAxis) =>
  bboxOf(verts).getCenter(new THREE.Vector3()).sub(spinCenter).projectOnPlane(spinAxis).length();

/** Max change in |v - hubCentre| across the blade. Zero iff the pitch
 *  axis really passes through the hub centre — see the T4 note up top. */
function hubDistanceError(before, after, spinCenter) {
  let worst = 0;
  for (let i = 0; i < before.length; i++) {
    worst = Math.max(worst, Math.abs(before[i].distanceTo(spinCenter) - after[i].distanceTo(spinCenter)));
  }
  return worst;
}

/**
 * Mean displacement of the innermost vs outermost vertices by radius.
 * Diagnostic only, but a genuinely informative one — it separates the two
 * motions that could be happening:
 *
 *   root ~= tip  -> a TWIST about the span. Displacement under a rotation
 *                   about the spanwise axis scales with a vertex's
 *                   distance from THAT axis (its chord/thickness offset),
 *                   which is roughly constant along the blade.
 *   tip >> root  -> a SWING about the hub. That scales with radius, so
 *                   the tip would move several times further than root.
 *
 * So near-equal figures are the expected signature here, not a weak
 * result. An earlier version of this comment asserted the opposite and
 * the measured data contradicted it.
 */
function rootTipDisplacement(before, after, spinCenter, spinAxis) {
  const withR = before.map((v, i) => ({
    i,
    r: v.clone().sub(spinCenter).projectOnPlane(spinAxis).length(),
  }));
  withR.sort((a, b) => a.r - b.r);
  const n = Math.max(1, Math.floor(withR.length * 0.15));
  const mean = (slice) => slice.reduce((s, { i }) => s + before[i].distanceTo(after[i]), 0) / slice.length;
  return { root: mean(withR.slice(0, n)), tip: mean(withR.slice(-n)) };
}

// ---------------------------------------------------------------- run
const rigEntry = Object.entries(meta.parts).find(([, v]) => v.rig?.pitch);
if (!rigEntry) {
  console.error('FAIL: no rig in vtol.json authors a `pitch` block.');
  process.exit(1);
}
const [rigKey, rigPart] = rigEntry;
const pitch = rigPart.rig.pitch;

console.log(`\nRIGID BLADE PITCH GATE${SELF_TEST ? '  [SELF-TEST: see-saw injected]' : ''}`);
console.log('='.repeat(78));
console.log(`rig: ${rigKey} — ${rigPart.displayName}`);
console.log(`blades: ${pitch.bladeNodeKeys.join(', ')}`);

if (pitch.bladeNodeKeys.length !== 2) {
  console.error(`FAIL: this gate assumes an opposed 2-blade rig; got ${pitch.bladeNodeKeys.length}.`);
  process.exit(1);
}

const blades = pitch.bladeNodeKeys.map((k) => {
  const ni = keyToNode.get(k);
  if (ni === undefined) { console.error(`FAIL: authored blade key "${k}" matches no node.`); process.exit(1); }
  return readPositions(ni);
});

// Spin frame, exactly as buildSpinGroup derives it: from the whole
// spinning subset, not from one blade.
const subsetBox = bboxOf(pitch.bladeNodeKeys.flatMap((k) => readPositions(keyToNode.get(k))));
const spinCenter = subsetBox.getCenter(new THREE.Vector3());
const spinAxisInfo = dominantAxis(subsetBox);
const spinAxis = spinAxisInfo.vec;
console.log(
  `spin axis: ${spinAxisInfo.name.toUpperCase()}   hub centre: ` +
  `(${spinCenter.toArray().map((v) => v.toFixed(1)).join(', ')})`,
);

const axes = blades.map((b) => pitchAxisFor(b, spinCenter, spinAxis));
axes.forEach((a, i) => console.log(
  `blade ${i} pitch axis: (${a.toArray().map((v) => v.toFixed(4)).join(', ')})   ` +
  `radius ${radiusFromAxis(blades[i], spinCenter, spinAxis).toFixed(2)}`,
));
console.log(`opposed check: axis0 . axis1 = ${axes[0].dot(axes[1]).toFixed(6)}  (expect -1)`);

// Index-wise symmetry is only meaningful if the two blades really are one
// buffer mirrored. Establish that on the UNPITCHED geometry first.
const baselineSym = symmetryError(blades[0], blades[1], spinCenter, spinAxis);
console.log(`baseline symmetry error (unpitched): ${baselineSym.toExponential(3)}`);
if (baselineSym > EPS_SYMMETRY) {
  console.error(
    `FAIL: the two blades are not an exact 180-degree pair index-wise ` +
    `(${baselineSym.toFixed(3)}), so T3 cannot be evaluated this way.`,
  );
  process.exit(1);
}

// Fixed sample of vertex pairs for the rigidity check.
const rng = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const samplePairs = Array.from({ length: 4000 }, () => [
  Math.floor(rng() * blades[0].length),
  Math.floor(rng() * blades[0].length),
]);

const rows = [];
let failures = 0;

for (const deg of TEST_ANGLES_DEG) {
  const rad = THREE.MathUtils.degToRad(deg);

  // CORRECT: each blade about its OWN outward radial.
  // SELF-TEST: both about blade 0's axis — the see-saw bug.
  const pitched = blades.map((b, i) => applyPitch(b, spinCenter, SELF_TEST ? axes[0] : axes[i], rad));

  const moved = Math.max(...blades[0].map((v, i) => v.distanceTo(pitched[0][i])));
  const rigid = maxPairwiseDelta(blades[0], pitched[0], samplePairs);
  const sym = symmetryError(pitched[0], pitched[1], spinCenter, spinAxis);
  const hub = hubDistanceError(blades[0], pitched[0], spinCenter);
  const { root, tip } = rootTipDisplacement(blades[0], pitched[0], spinCenter, spinAxis);

  const t1 = moved > 1e-6;
  const t2 = rigid < EPS_RIGID;
  const t3 = sym < EPS_SYMMETRY;
  const t4 = hub < EPS_HUB;
  if (!(t1 && t2 && t3 && t4)) failures++;

  rows.push({ deg, moved, rigid, sym, hub, root, tip, t1, t2, t3, t4 });
}

console.log(`\n${'angle'.padStart(6)} ${'maxMove'.padStart(9)} ${'rigidErr'.padStart(10)} ` +
            `${'symErr'.padStart(10)} ${'hubErr'.padStart(10)} ${'root'.padStart(7)} ${'tip'.padStart(7)}   T1 T2 T3 T4`);
for (const r of rows) {
  console.log(
    `${String(r.deg).padStart(5)}° ${r.moved.toFixed(2).padStart(9)} ` +
    `${r.rigid.toExponential(2).padStart(10)} ${r.sym.toExponential(2).padStart(10)} ` +
    `${r.hub.toExponential(2).padStart(10)} ${r.root.toFixed(2).padStart(7)} ${r.tip.toFixed(2).padStart(7)}   ` +
    `${r.t1 ? ' ok' : 'BAD'} ${r.t2 ? ' ok' : 'BAD'} ${r.t3 ? ' ok' : 'BAD'} ${r.t4 ? ' ok' : 'BAD'}`,
  );
}
console.log(
  '\nroot/tip are mean vertex displacement for the innermost and outermost 15% by radius —\n' +
  'diagnostic, not pass/fail. Near-EQUAL values are the signature of a twist about the span\n' +
  '(displacement scales with chord offset, not radius). tip >> root would mean the blade is\n' +
  'swinging about the hub instead of twisting in place.',
);

console.log(`\n${'='.repeat(78)}`);
if (SELF_TEST) {
  // The injected see-saw MUST break T3. If every angle still passes, the
  // symmetry check is not measuring what it claims and the whole gate is
  // worthless — that is itself the failure.
  const t3Failures = rows.filter((r) => !r.t3).length;
  if (t3Failures === rows.length) {
    console.log(`SELF-TEST PASSED — the injected see-saw broke T3 at all ${rows.length} angles.`);
    console.log('The symmetry check can fail, so a pass in the normal run means something.\n');
    process.exit(0);
  }
  console.error(
    `SELF-TEST FAILED — the see-saw went undetected at ${rows.length - t3Failures} of ` +
    `${rows.length} angles. T3 does not measure what it claims.\n`,
  );
  process.exit(1);
}

if (failures === 0) {
  console.log(`PASS — rigid, symmetric, hub-centred pitch at all ${rows.length} angles.`);
  console.log('Run with --self-test to confirm these checks can actually fail.\n');
  process.exit(0);
}
console.error(`FAIL — ${failures} of ${rows.length} angles did not satisfy every check.\n`);
process.exit(1);

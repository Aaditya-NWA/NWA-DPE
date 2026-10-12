// path: cad-pipeline/analyze_blade_separability.mjs
/**
 * DECIDES WHETHER TRUE RIGID-BODY BLADE PITCH IS POSSIBLE ON THIS ASSET
 * (2026-08-04, feature-002-variablePitch). Read this before writing any
 * pitch code.
 *
 * WHY THIS MEASUREMENT AND NOT AN ASSUMPTION: variable pitch has already
 * failed once in this project (MEMORY.md 2026-07-17). The original PoC
 * propeller was a SINGLE FUSED SOLID — blades and hub as one body — so
 * pitch could only be attempted as a per-vertex deformation, which shears
 * every triangle spanning the blend boundary and visibly frayed the blade
 * edges at 25 degrees. It is a parked known failure, not an untried idea.
 *
 * A rigid pitch rotation needs each blade to be its OWN rigid body,
 * rotatable about its own spanwise axis. This script answers, per rig:
 *
 *   Q1 how many blades are in the spinning subset?      (angular lobes)
 *   Q2 are they already separate GLB solids?            (node count)
 *   Q3 if not, could we SPLIT them offline?             (mesh connectivity)
 *
 * Q3 is the one that decides whether a fused solid is recoverable. If a
 * fused prop's blades are DISCONNECTED mesh islands, an offline split is
 * exact and lossless. If the whole prop is ONE connected watertight solid
 * — which is what a real one-piece cast/machined propeller actually is —
 * then no split exists, and rigid pitch on that rig is impossible without
 * re-entering the failed vertex-deformation path.
 *
 * WHY A 2-BLADE FUSED SOLID CANNOT SIMPLY BE ROTATED ABOUT ITS SPANWISE
 * AXIS (the tempting shortcut, and it is wrong): let B be the blade pair,
 * symmetric under R_Y(180). Pitching must preserve that 2-fold symmetry —
 * both blades must end at the SAME pitch angle. But
 *   R_Y(180) . R_X(θ) . R_Y(180)^-1 = R_X(-θ)
 * so rotating the whole body about X sends one blade to +θ and the other
 * to -θ. That is a see-saw / teetering motion, not a pitch change. The
 * blades must be independent rigid bodies to pitch together.
 *
 * WHAT THE METRIC WOULD RETURN IF THE ANSWER WERE THE OPPOSITE (standing
 * rule, MEMORY.md section 5): a fused N-blade solid yields N angular lobes
 * and, if splittable, N+ mesh components; a genuinely separate blade
 * yields 1 and 1. Different integers in every case, so the check can fail.
 *
 * METHOD: decode the real POSITION and index accessors. Angular lobes are
 * counted by projecting vertices onto the plane perpendicular to the spin
 * axis (hub-radius vertices excluded — hub material spans every angle and
 * would merge all lobes). Connectivity is union-find over triangles after
 * welding vertices by position, because CAD exports duplicate vertices at
 * hard edges and un-welded connectivity would report spurious islands.
 *
 * Valid because these STEP->GLB solids have IDENTITY transforms with
 * geometry baked into the vertices (MEMORY.md 2026-07-29).
 *
 *   node cad-pipeline/analyze_blade_separability.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Defaults to the VTOL, the asset this script was written against.
 *  Parameterised 2026-09-07 so the same gate can decide the question for
 *  any new product before pitch is authored on it — the AXOM rotors were
 *  all measured this way rather than assumed fused. */
const GLB = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(HERE, '..', 'public', 'models', 'vtol_airframe.glb');
const META = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(HERE, '..', 'public', 'metadata', 'vtol.json');

/** Angular gap below which two runs are the same blade. A blade is one
 *  twisted airfoil; sparse vertex sampling across its span can leave a
 *  few empty 1-degree bins mid-blade. Real blades on this prop sit ~180
 *  or ~90 degrees apart, far above this. */
const MERGE_GAP_DEG = 12;
/** Vertices inside this fraction of max radius are hub, not blade. */
const HUB_FRACTION = 0.35;

// ---------------------------------------------------------------- read
function readGlb(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  const binHeader = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binHeader);
  const bin = buf.slice(binHeader + 8, binHeader + 8 + binLen);
  return { json, bin };
}

const { json: gltf, bin } = readGlb(GLB);
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));

/** GLTFLoader.createUniqueName: sanitize, then `_N` per repeat, against
 *  one file-global registry, in node-index order (root is node 0). */
const used = Object.create(null);
const runtimeNames = gltf.nodes.map((n) => {
  const s = THREE.PropertyBinding.sanitizeNodeName(n.name || '');
  if (s in used) return `${s}_${++used[s]}`;
  used[s] = 0;
  return s;
});

const rootNodeIndex = gltf.scenes[gltf.scene ?? 0].nodes[0];
const topLevel = gltf.nodes[rootNodeIndex].children ?? [];
const keyToNode = new Map();
topLevel.forEach((nodeIdx, i) => {
  keyToNode.set(`${runtimeNames[nodeIdx]}#${i}`, nodeIdx);
});

// ------------------------------------------------------- accessor read
function accessorBytes(accessorIdx) {
  const accessor = gltf.accessors[accessorIdx];
  const view = gltf.bufferViews[accessor.bufferView];
  return { accessor, base: (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), stride: view.byteStride };
}

function readPositions(nodeIdx) {
  const node = gltf.nodes[nodeIdx];
  if (node.mesh === undefined) return null;
  const out = [];
  for (const prim of gltf.meshes[node.mesh].primitives) {
    const { accessor, base, stride } = accessorBytes(prim.attributes.POSITION);
    if (accessor.componentType !== 5126 || accessor.type !== 'VEC3') {
      throw new Error(`unexpected POSITION format on node ${nodeIdx}`);
    }
    const s = stride ?? 12;
    for (let i = 0; i < accessor.count; i++) {
      const o = base + i * s;
      out.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
    }
  }
  return out;
}

/** Per-primitive {positions, indices}, so connectivity is computed in the
 *  same index space the triangles actually reference. */
function readPrimitives(nodeIdx) {
  const node = gltf.nodes[nodeIdx];
  if (node.mesh === undefined) return [];
  return gltf.meshes[node.mesh].primitives.map((prim) => {
    const { accessor: pa, base: pb, stride: ps } = accessorBytes(prim.attributes.POSITION);
    const sp = ps ?? 12;
    const positions = [];
    for (let i = 0; i < pa.count; i++) {
      const o = pb + i * sp;
      positions.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
    }
    let indices = null;
    if (prim.indices !== undefined) {
      const { accessor: ia, base: ib } = accessorBytes(prim.indices);
      indices = [];
      const width = ia.componentType === 5125 ? 4 : ia.componentType === 5123 ? 2 : 1;
      for (let i = 0; i < ia.count; i++) {
        const o = ib + i * width;
        indices.push(width === 4 ? bin.readUInt32LE(o) : width === 2 ? bin.readUInt16LE(o) : bin.readUInt8(o));
      }
    }
    return { positions, indices };
  });
}

// -------------------------------------------------------- connectivity
/** Counts connected mesh islands after welding coincident vertices.
 *  Welding matters: CAD exports split vertices at every hard edge for
 *  faceted normals, so raw index connectivity would report one island per
 *  smoothing group and wildly overstate separability. */
function countMeshComponents(prims) {
  const weld = new Map();
  const parent = [];
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

  /** Quantize to 1e-3 of a unit. These are millimetre-scale CAD solids in
   *  the hundreds of units, so 1e-3 merges only genuinely coincident
   *  vertices and never distinct surface points. */
  const keyOf = (p) => `${Math.round(p[0] * 1000)},${Math.round(p[1] * 1000)},${Math.round(p[2] * 1000)}`;

  const weldedOf = [];
  for (const prim of prims) {
    const local = prim.positions.map((p) => {
      const k = keyOf(p);
      let id = weld.get(k);
      if (id === undefined) { id = parent.length; parent.push(id); weld.set(k, id); }
      return id;
    });
    weldedOf.push(local);
  }

  prims.forEach((prim, pi) => {
    const local = weldedOf[pi];
    const idx = prim.indices ?? local.map((_, i) => i);
    for (let i = 0; i + 2 < idx.length; i += 3) {
      union(local[idx[i]], local[idx[i + 1]]);
      union(local[idx[i + 1]], local[idx[i + 2]]);
    }
  });

  const roots = new Set();
  for (let i = 0; i < parent.length; i++) roots.add(find(i));
  return { components: roots.size, weldedVerts: parent.length };
}

// ------------------------------------------------------------ analysis
function perpendicularBasis(axis) {
  const helper = Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) < 0.9
    ? new THREE.Vector3(0, 1, 0)
    : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u).normalize();
  return { u, v };
}

/** Blade count = disjoint angular lobes around the spin axis, after
 *  merging runs separated by less than MERGE_GAP_DEG. */
function countBlades(verts, axisVec, center) {
  const a = new THREE.Vector3(...axisVec);
  const { u, v } = perpendicularBasis(a);
  const c = new THREE.Vector3(...center);

  const polar = verts.map((p) => {
    const d = new THREE.Vector3(p[0], p[1], p[2]).sub(c);
    return { r: Math.hypot(d.dot(u), d.dot(v)), theta: Math.atan2(d.dot(v), d.dot(u)) };
  });
  const maxR = Math.max(...polar.map((p) => p.r));
  const cutoff = maxR * HUB_FRACTION;

  const BINS = 360;
  const occupied = new Array(BINS).fill(false);
  for (const p of polar) {
    if (p.r < cutoff) continue;
    let b = Math.floor(((p.theta + Math.PI) / (Math.PI * 2)) * BINS);
    occupied[Math.min(BINS - 1, Math.max(0, b))] = true;
  }

  // Close gaps smaller than MERGE_GAP_DEG before counting runs.
  const closed = occupied.slice();
  for (let i = 0; i < BINS; i++) {
    if (occupied[i]) continue;
    let gap = 0;
    while (gap < BINS && !occupied[(i + gap) % BINS]) gap++;
    if (gap > 0 && gap < MERGE_GAP_DEG && occupied[(i - 1 + BINS) % BINS]) {
      for (let g = 0; g < gap; g++) closed[(i + g) % BINS] = true;
    }
  }

  let blades = 0;
  const spans = [];
  for (let i = 0; i < BINS; i++) {
    if (closed[i] && !closed[(i - 1 + BINS) % BINS]) {
      blades++;
      let len = 0;
      while (closed[(i + len) % BINS] && len < BINS) len++;
      spans.push(len);
    }
  }
  if (blades === 0 && closed.some(Boolean)) blades = 1;
  return { blades, spans, maxR };
}

function bboxOf(verts) {
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const q of verts) box.expandByPoint(p.set(q[0], q[1], q[2]));
  return box;
}

function dominantAxis(box) {
  const s = box.getSize(new THREE.Vector3());
  return [
    { name: 'x', value: s.x, vec: [1, 0, 0] },
    { name: 'y', value: s.y, vec: [0, 1, 0] },
    { name: 'z', value: s.z, vec: [0, 0, 1] },
  ].sort((a, b) => a.value - b.value)[0];
}

// ---------------------------------------------------------------- main
const rigs = Object.entries(meta.parts).filter(([, v]) => v.rig);
console.log(`\nBLADE SEPARABILITY — ${rigs.length} authored rigs in ${path.basename(META)}`);
console.log('='.repeat(80));

const verdicts = [];

for (const [key, part] of rigs) {
  console.log(`\n${part.displayName}`);
  console.log(`  rig key: ${key}`);

  // Spin axis from the WHOLE spinning subset's box, exactly as Model.tsx
  // buildSpinGroup does — not per-solid, or a lone blade would report its
  // own thin dimension instead of the rig's true rotation axis.
  const subsetVerts = [];
  for (const sk of part.rig.spinningNodeKeys) {
    const ni = keyToNode.get(sk);
    if (ni === undefined) { console.log(`  !! key not in GLB: ${sk}`); continue; }
    const v = readPositions(ni);
    if (v) subsetVerts.push(...v);
  }
  const subsetBox = bboxOf(subsetVerts);
  const subsetCenter = subsetBox.getCenter(new THREE.Vector3()).toArray();
  const axis = dominantAxis(subsetBox);
  const size = subsetBox.getSize(new THREE.Vector3());
  console.log(
    `  spinning subset bbox: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}` +
    `  -> spin axis ${axis.name.toUpperCase()} (thinnest)`,
  );

  let totalBlades = 0;
  let maxComponents = 0;
  for (const sk of part.rig.spinningNodeKeys) {
    const ni = keyToNode.get(sk);
    if (ni === undefined) continue;
    const verts = readPositions(ni);
    const b = countBlades(verts, axis.vec, subsetCenter);
    const conn = countMeshComponents(readPrimitives(ni));
    totalBlades += b.blades;
    maxComponents = Math.max(maxComponents, conn.components);
    console.log(
      `    ${sk.padEnd(22)} verts=${String(verts.length).padStart(5)} ` +
      `welded=${String(conn.weldedVerts).padStart(5)}  blades=${b.blades} ` +
      `spans(deg)=[${b.spans.join(', ')}]  meshIslands=${conn.components}`,
    );
  }

  const solids = part.rig.spinningNodeKeys.length;
  const alreadySeparate = solids > 1 && totalBlades / solids <= 1.0001;
  const splittable = !alreadySeparate && maxComponents >= 2;
  verdicts.push({ name: part.displayName, solids, blades: totalBlades, alreadySeparate, splittable, islands: maxComponents });

  const verdict = alreadySeparate
    ? 'SEPARABLE — rigid pitch possible today'
    : splittable
      ? `SPLITTABLE — ${maxComponents} disconnected islands, an offline split would recover it`
      : 'FUSED, ONE SOLID BODY — rigid per-blade pitch impossible';
  console.log(`  => ${totalBlades} blade(s) across ${solids} solid(s)  [${verdict}]`);
}

console.log(`\n${'='.repeat(80)}`);
console.log('VERDICT');
for (const v of verdicts) {
  const tag = v.alreadySeparate ? 'SEPARABLE ' : v.splittable ? 'SPLITTABLE' : 'FUSED     ';
  console.log(`  ${tag}  ${v.blades} blade(s) / ${v.solids} solid(s) / ${v.islands} island(s)   ${v.name}`);
}
const ok = verdicts.filter((v) => v.alreadySeparate).length;
const fixable = verdicts.filter((v) => v.splittable).length;
console.log(
  `\n  ${ok} of ${verdicts.length} rigs support TRUE rigid-body blade pitch as authored.` +
  `\n  ${fixable} more could be recovered by an offline mesh split.\n`,
);

// path: cad-pipeline/verify_explode_reassembles.js
//
// PURPOSE (2026-09-07): prove, with real three.js objects, that returning
// the explode control to 0 puts every solid back EXACTLY where it started
// — including the solids that live inside a spin group.
//
// THE BUG THIS EXISTS TO CATCH, reported by the project owner as "in tour
// mode when it explodes it should come back to the assembled position;
// currently it explodes and leaves the model there itself":
//
//   src/components/Model.tsx runs its effects in DECLARATION order. The
//   explode effect used to be declared BEFORE the two spin-group effects,
//   so it captured each top-level child's baseline `.position` while the
//   tree was still pristine. The spin effects then REPARENTED the rotor
//   solids into spin groups, and `buildSpinGroup` rewrites each reparented
//   child's `.position` to compensate for the group's pivot. Every later
//   explode write copied the stale pre-reparent baseline back onto a node
//   that no longer lived in that space — so explode(0) did not reassemble
//   the aircraft, it left every rotor displaced by its spin group's own
//   centroid, permanently, for as long as the screen was open.
//
// WHY THIS IS AN A/B SCRIPT AND NOT A ONE-SIDED CHECK. Running the fixed
// order alone and printing "residual 0.0000" would prove nothing: a
// residual of zero is also what a check measuring the wrong quantity
// prints. This runs BOTH orders on the same scene and requires the broken
// one to FAIL — the injected bug is the old declaration order itself, so
// a pass means the metric can actually express the failure. That is the
// standing rule in docs/MEMORY.md §5.
//
// WHAT IS MEASURED: the WORLD-SPACE centre of each solid's geometry, not
// its `.position`. These CAD solids have identity transforms with their
// geometry baked into the vertices (docs/MEMORY.md, invariant 1), so
// `.position` is 0 for all of them before the reparent and says nothing
// about where anything is drawn. World geometry centres are what a person
// standing at the kiosk actually sees.
//
// Runs on generated mock geometry, so it needs no CAD files.
//
//   node cad-pipeline/verify_explode_reassembles.js

const THREE = require('three');

const TOLERANCE = 1e-6;

// ---------------------------------------------------------------------
// Mirrors of the real implementations in src/lib/geometry.ts and
// src/components/Model.tsx. Kept deliberately literal — the point is to
// run the same arithmetic the app runs, not a tidier version of it.
// ---------------------------------------------------------------------

function computeLocalBoundingBox(root) {
  root.updateWorldMatrix(true, true);
  const rootWorldInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tempBox = new THREE.Box3();
  const relativeMatrix = new THREE.Matrix4();
  root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      tempBox.copy(obj.geometry.boundingBox);
      relativeMatrix.multiplyMatrices(rootWorldInverse, obj.matrixWorld);
      tempBox.applyMatrix4(relativeMatrix);
      box.union(tempBox);
    }
  });
  return box;
}

function detectDominantAxis(box) {
  const size = box.getSize(new THREE.Vector3());
  const dims = [
    { value: size.x, vector: new THREE.Vector3(1, 0, 0) },
    { value: size.y, vector: new THREE.Vector3(0, 1, 0) },
    { value: size.z, vector: new THREE.Vector3(0, 0, 1) },
  ];
  dims.sort((a, b) => a.value - b.value);
  return dims[0].vector;
}

/** src/components/Model.tsx buildSpinGroup, unchanged in substance. */
function buildSpinGroup(rootWrapper, keys) {
  const toSpin = rootWrapper.children.filter((c) => keys.has(c.name));
  if (toSpin.length === 0) return null;
  const group = new THREE.Group();
  group.name = '__spinSubset';
  group.userData.isSpinSubsetGroup = true;
  rootWrapper.add(group);
  rootWrapper.updateMatrixWorld(true);
  toSpin.forEach((child) => group.attach(child));
  const center = computeLocalBoundingBox(group).getCenter(new THREE.Vector3());
  group.position.copy(center);
  toSpin.forEach((child) => child.position.sub(center));
  return group;
}

/** The OLD explode capture: no child.matrix, radial only. */
function captureExplodeOld(rootWrapper) {
  const candidates = rootWrapper.children.slice();
  if (candidates.length < 2) return null;
  const overallBox = computeLocalBoundingBox(rootWrapper);
  const overallCenter = overallBox.getCenter(new THREE.Vector3());
  const overallSize = overallBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(overallSize.x, overallSize.y, overallSize.z) || 1;
  return candidates.map((child) => {
    const childCenter = computeLocalBoundingBox(child).getCenter(new THREE.Vector3());
    const dir = childCenter.clone().sub(overallCenter);
    if (dir.lengthSq() < 1e-8) dir.set(0, 0, 0);
    else dir.normalize();
    return { child, basePos: child.position.clone(), radial: dir.multiplyScalar(maxDim * 0.6), axial: new THREE.Vector3() };
  });
}

/** The CURRENT explode capture, including the axial direction. */
function captureExplodeNew(rootWrapper) {
  const candidates = rootWrapper.children.slice();
  if (candidates.length < 2) return null;
  const overallBox = computeLocalBoundingBox(rootWrapper);
  const overallCenter = overallBox.getCenter(new THREE.Vector3());
  const overallSize = overallBox.getSize(new THREE.Vector3());
  const maxDim = Math.max(overallSize.x, overallSize.y, overallSize.z) || 1;
  const layerAxis = detectDominantAxis(overallBox);
  const halfExtent = Math.max(1e-6, overallSize.dot(layerAxis) / 2);

  return candidates.map((child) => {
    child.updateMatrix();
    const childCenter = computeLocalBoundingBox(child)
      .getCenter(new THREE.Vector3())
      .applyMatrix4(child.matrix);
    const offset = childCenter.clone().sub(overallCenter);
    const radial = offset.clone();
    if (radial.lengthSq() < 1e-8) radial.set(0, 0, 0);
    else radial.normalize();
    radial.multiplyScalar(maxDim * 0.6);
    const axial = layerAxis.clone().multiplyScalar((offset.dot(layerAxis) / halfExtent) * maxDim * 0.5);
    return { child, basePos: child.position.clone(), radial, axial };
  });
}

function applyExplode(data, amount, mode) {
  data.forEach(({ child, basePos, radial, axial }) => {
    child.position.copy(basePos).addScaledVector(mode === 'axial' ? axial : radial, amount);
  });
}

// ---------------------------------------------------------------------
// A mock aircraft: a flat frame with four rotors out at the corners, one
// of which is a rig (hub + blades as separate solids, so it gets a spin
// group). Flat in Y so the thin axis — the one the LAYERED explode uses —
// is unambiguous, exactly as it is on the real multirotors.
// ---------------------------------------------------------------------

function bakedSolid(name, at, size) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);
  // Baked into the vertices, node transform left at identity. This is what
  // the STEP->GLB pipeline produces and it is why `.position` is useless
  // as a measurement here.
  geometry.translate(at[0], at[1], at[2]);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.name = name;
  return mesh;
}

const SPIN_KEYS = new Set(['blade_a', 'blade_b']);

function buildScene() {
  const scene = new THREE.Scene();
  const rootWrapper = new THREE.Group();
  rootWrapper.name = 'rootWrapper';
  scene.add(rootWrapper);

  rootWrapper.add(bakedSolid('frame', [0, 0, 0], [700, 30, 700]));
  rootWrapper.add(bakedSolid('battery', [0, -60, 0], [180, 60, 90]));
  rootWrapper.add(bakedSolid('gps', [0, 90, 0], [40, 20, 40]));
  rootWrapper.add(bakedSolid('arm_ne', [300, 0, -300], [200, 20, 40]));
  rootWrapper.add(bakedSolid('arm_sw', [-300, 0, 300], [200, 20, 40]));
  // The rig: a hub that stays put and two blades that spin.
  rootWrapper.add(bakedSolid('hub', [520, 30, -310], [40, 40, 40]));
  rootWrapper.add(bakedSolid('blade_a', [600, 44, -310], [180, 8, 30]));
  rootWrapper.add(bakedSolid('blade_b', [440, 44, -310], [180, 8, 30]));

  scene.updateMatrixWorld(true);
  return { scene, rootWrapper };
}

/** Where each named solid's geometry actually is, in world space. */
function worldCentres(scene) {
  const out = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
    out.set(obj.name, obj.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(obj.matrixWorld));
  });
  return out;
}

function maxResidual(before, after) {
  let worst = 0;
  let worstName = '—';
  for (const [name, p] of before) {
    const q = after.get(name);
    const d = q ? p.distanceTo(q) : Infinity;
    if (d > worst) { worst = d; worstName = name; }
  }
  return { worst, worstName };
}

// ---------------------------------------------------------------------

function runRoundTrip({ captureFirst, capture, mode }) {
  const { scene, rootWrapper } = buildScene();
  const pristine = worldCentres(scene);

  let data;
  if (captureFirst) {
    // THE BUG: baselines taken before the spin group exists.
    data = capture(rootWrapper);
    buildSpinGroup(rootWrapper, SPIN_KEYS);
  } else {
    buildSpinGroup(rootWrapper, SPIN_KEYS);
    data = capture(rootWrapper);
  }

  applyExplode(data, 1, mode);
  const exploded = worstSeparation(scene, pristine);
  applyExplode(data, 0, mode);
  const back = worldCentres(scene);

  return { pristine, exploded, residual: maxResidual(pristine, back) };
}

/** How far the furthest solid travelled at full explode — the "did it do
 * anything at all" half of the check. A round trip that never moved would
 * otherwise return to its start perfectly and look like a pass. */
function worstSeparation(scene, pristine) {
  const now = worldCentres(scene);
  let worst = 0;
  for (const [name, p] of pristine) {
    const q = now.get(name);
    if (q) worst = Math.max(worst, p.distanceTo(q));
  }
  return worst;
}

function main() {
  let failures = 0;
  const line = (s) => console.log(s);

  line('EXPLODE ROUND TRIP — does explode(0) reassemble the aircraft?');
  line('');

  // --- A: the old declaration order, which is the injected bug ---------
  const oldOrder = runRoundTrip({ captureFirst: true, capture: captureExplodeOld, mode: 'radial' });
  line(`  A  OLD ORDER (capture, then build spin groups)`);
  line(`       travel at explode(1) ....... ${oldOrder.exploded.toFixed(3)} units`);
  line(`       residual after explode(0) .. ${oldOrder.residual.worst.toFixed(4)} units  (worst: ${oldOrder.residual.worstName})`);
  if (oldOrder.residual.worst <= TOLERANCE) {
    line('       ✗ THE INJECTED BUG WENT UNDETECTED — this check cannot fail,');
    line('         so it proves nothing about the fix. Fix the check.');
    failures++;
  } else {
    line('       ✓ detected, as it must be: the rotor solids come to rest');
    line('         displaced by their spin group’s centroid.');
  }
  line('');

  // --- B: the shipped order -------------------------------------------
  for (const mode of ['radial', 'axial']) {
    const fixed = runRoundTrip({ captureFirst: false, capture: captureExplodeNew, mode });
    line(`  B  CURRENT ORDER (build spin groups, then capture) — ${mode.toUpperCase()}`);
    line(`       travel at explode(1) ....... ${fixed.exploded.toFixed(3)} units`);
    line(`       residual after explode(0) .. ${fixed.residual.worst.toFixed(4)} units  (worst: ${fixed.residual.worstName})`);
    if (fixed.exploded < 1) {
      line('       ✗ nothing moved at full explode, so the round trip is vacuous.');
      failures++;
    } else if (fixed.residual.worst > TOLERANCE) {
      line('       ✗ the aircraft did NOT return to its assembled positions.');
      failures++;
    } else {
      line('       ✓ every solid back to its exact starting point.');
    }
    line('');
  }

  if (failures === 0) {
    console.log('PASS: the old order is caught, and the current order reassembles exactly.');
    process.exit(0);
  }
  console.log(`FAIL: ${failures} problem(s) above.`);
  process.exit(1);
}

main();

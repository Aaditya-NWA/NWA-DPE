// path: cad-pipeline/verify_subset_spin_pivot.js
//
// PURPOSE (2026-07-29): prove, with real three.js objects, whether the
// subset-spin reparenting in src/components/Model.tsx makes a propeller
// SPIN IN PLACE or JUMP AND ORBIT — the ITEM 3 bug in docs/TODO.md
// ("propeller separates from hub on entering Try RPM").
//
// WHY THIS SCRIPT EXISTS AT ALL, given docs/MEMORY.md records the 5 rigs
// as verified at "exactly 0.0000" drift on 2026-07-27:
//
//   That verification measured each spinning child's LOCAL .position.
//   A child's local position is MATHEMATICALLY INVARIANT under rotation
//   of its parent — it reads identical whether the object spins in place
//   or orbits a hundred units away. The check could not fail, so it
//   proved nothing about orbiting. Detecting an orbit requires WORLD
//   position (getWorldPosition), sampled across the rotation.
//
//   This is the same class of blind spot MEMORY.md already documents for
//   the blade-pitch work ("numeric aggregate stats are not a substitute
//   for actually looking at the result") — a metric that cannot express
//   the failure mode being tested for.
//
// This script therefore measures WORLD positions only.

const THREE = require('three');

// ---------------------------------------------------------------------
// Mirror of the real scene shape: a propeller solid and its separate hub
// bracket, sitting OUT at an aircraft corner (not at the world origin).
// The offset is the whole point — at the origin the bug is invisible.
// ---------------------------------------------------------------------
const PROP_WORLD = new THREE.Vector3(520, 40, -310);
const HUB_WORLD = new THREE.Vector3(520, 22, -310);

function makeSolid(name, worldPos, size) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size[0], size[1], size[2]),
    new THREE.MeshBasicMaterial(),
  );
  mesh.name = name;
  mesh.position.copy(worldPos);
  return mesh;
}

function buildScene() {
  const scene = new THREE.Scene();
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  const spinSubset = new THREE.Group();
  const rootWrapper = new THREE.Group();
  rootWrapper.name = 'rootWrapper';

  // Blade-like: thin in Y, so detectDominantAxis picks Y (as in the real
  // 4 corner lift props).
  rootWrapper.add(makeSolid('prop', PROP_WORLD, [180, 6, 180]));
  rootWrapper.add(makeSolid('hub', HUB_WORLD, [30, 24, 30]));

  scene.add(pivot);
  pivot.add(spin);
  spin.add(spinSubset);
  spin.add(rootWrapper);
  scene.updateMatrixWorld(true);
  return { scene, spinSubset, rootWrapper };
}

// Ported verbatim from src/lib/geometry.ts
function computeLocalBoundingBox(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const rel = new THREE.Matrix4();
  root.traverse((obj) => {
    if (obj.isMesh && obj.geometry) {
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
      tmp.copy(obj.geometry.boundingBox);
      rel.multiplyMatrices(inv, obj.matrixWorld);
      tmp.applyMatrix4(rel);
      box.union(tmp);
    }
  });
  return box;
}

function detectDominantAxis(box) {
  const s = box.getSize(new THREE.Vector3());
  const dims = [
    { v: s.x, vec: new THREE.Vector3(1, 0, 0) },
    { v: s.y, vec: new THREE.Vector3(0, 1, 0) },
    { v: s.z, vec: new THREE.Vector3(0, 0, 1) },
  ].sort((a, b) => a.v - b.v);
  return dims[0].vec;
}

// ---------------------------------------------------------------------
// CURRENT shipped logic (Model.tsx as of this script's writing)
// ---------------------------------------------------------------------
function applyCurrent(spinSubset, rootWrapper) {
  const toSpin = rootWrapper.children.filter((c) => c.name === 'prop');
  spinSubset.position.set(0, 0, 0);
  spinSubset.quaternion.identity();
  toSpin.forEach((c) => spinSubset.attach(c));

  const box = computeLocalBoundingBox(spinSubset);
  const center = box.getCenter(new THREE.Vector3());
  const axis = detectDominantAxis(box);

  spinSubset.position.copy(center);   // <-- children NOT compensated
  spinSubset.parent.updateMatrixWorld(true);
  return axis;
}

// ---------------------------------------------------------------------
// PROPOSED fix: compensate each child so world position is preserved.
// ---------------------------------------------------------------------
function applyFixed(spinSubset, rootWrapper) {
  const toSpin = rootWrapper.children.filter((c) => c.name === 'prop');
  spinSubset.position.set(0, 0, 0);
  spinSubset.quaternion.identity();
  toSpin.forEach((c) => spinSubset.attach(c));

  const box = computeLocalBoundingBox(spinSubset);
  const center = box.getCenter(new THREE.Vector3());
  const axis = detectDominantAxis(box);

  spinSubset.position.copy(center);
  // Move each child back by the same amount the group moved forward, so
  // net world position is unchanged AND the group's origin now sits at
  // the subset's true centroid => rotation pivots about that centroid.
  toSpin.forEach((c) => c.position.sub(center));
  spinSubset.parent.updateMatrixWorld(true);
  return axis;
}

function worldPosOf(root, name) {
  let found = null;
  root.traverse((o) => { if (o.name === name) found = o; });
  const v = new THREE.Vector3();
  found.getWorldPosition(v);
  return v;
}

function run(label, applyFn) {
  const { scene, spinSubset, rootWrapper } = buildScene();

  const propBefore = worldPosOf(scene, 'prop').clone();
  const hubBefore = worldPosOf(scene, 'hub').clone();

  const axis = applyFn(spinSubset, rootWrapper);
  scene.updateMatrixWorld(true);

  const propAfterMount = worldPosOf(scene, 'prop').clone();
  const hubAfterMount = worldPosOf(scene, 'hub').clone();

  // Now actually spin it, sampling WORLD position around the rotation.
  const samples = [];
  for (let i = 0; i < 8; i++) {
    spinSubset.rotateOnAxis(axis, Math.PI / 4);
    scene.updateMatrixWorld(true);
    samples.push(worldPosOf(scene, 'prop').clone());
  }
  let maxOrbitRadius = 0;
  samples.forEach((s) => {
    maxOrbitRadius = Math.max(maxOrbitRadius, s.distanceTo(propAfterMount));
  });

  return {
    label,
    jumpOnEnteringTryRPM: +propBefore.distanceTo(propAfterMount).toFixed(4),
    hubMoved: +hubBefore.distanceTo(hubAfterMount).toFixed(4),
    maxWorldTravelDuringSpin: +maxOrbitRadius.toFixed(4),
    localPositionDuringSpin_theMisleadingMetric: (() => {
      let p = null;
      scene.traverse((o) => { if (o.name === 'prop') p = o; });
      return +p.position.distanceTo(p.position).toFixed(4); // always 0
    })(),
  };
}

console.log('=== ITEM 3: subset-spin pivot verification (WORLD space) ===');
console.log('Prop sits at', PROP_WORLD.toArray(), '- offset from origin is what exposes the bug.\n');

const before = run('CURRENT (shipped)', applyCurrent);
const after = run('FIXED (compensated)', applyFixed);

for (const r of [before, after]) {
  console.log(`--- ${r.label} ---`);
  console.log(`  jump on entering Try RPM      : ${r.jumpOnEnteringTryRPM}`);
  console.log(`  hub moved                     : ${r.hubMoved}`);
  console.log(`  max world travel during spin  : ${r.maxWorldTravelDuringSpin}`);
  console.log(`  local .position delta (the metric used on 2026-07-27): ${r.localPositionDuringSpin_theMisleadingMetric}`);
  console.log('');
}

const propRadius = 90; // half of the 180-unit blade span
console.log('EXPECTED for a correct spin-in-place:');
console.log('  jump = 0, hub moved = 0, and max world travel <= blade radius (~' + propRadius + ')');
console.log('  because a point on the blade legitimately sweeps around the centroid.\n');

const pass =
  after.jumpOnEnteringTryRPM === 0 &&
  after.hubMoved === 0 &&
  after.maxWorldTravelDuringSpin <= propRadius * 2.05;

console.log('CURRENT logic verdict :', before.jumpOnEnteringTryRPM === 0 ? 'no jump' : `JUMPS by ${before.jumpOnEnteringTryRPM}`);
console.log('FIXED   logic verdict :', pass ? 'PASS - spins in place' : 'FAIL');

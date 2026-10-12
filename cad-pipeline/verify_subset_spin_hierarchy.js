// path: cad-pipeline/verify_subset_spin_hierarchy.js
//
// PURPOSE (2026-07-29): verify_subset_spin_pivot.js proved the missing
// centroid compensation, but it modelled ONLY the spin effect. The real
// Model.tsx also runs a legacy pivot effect that sets:
//
//     pivotRef.position   =  center(rootWrapper)
//     groupRef.position   = -center(rootWrapper)
//
// and the JSX nests them like this:
//
//     <group pivotRef>
//       <group spinRef>
//         <group spinSubsetRef />        <-- spinning children go HERE
//         <primitive groupRef …>         <-- hub stays in here
//
// spinSubsetRef and groupRef are SIBLINGS. So the -center offset applied
// to groupRef reaches the hub but NOT the reparented propeller, while
// pivotRef's +center reaches both. If that is real, the propeller ends
// up displaced by +center even after the centroid compensation is
// restored — a SECOND, independent source of hub/prop separation.
//
// Effect order matters and is modelled faithfully: React runs effects in
// declaration order, and in Model.tsx the subset-spin effect is declared
// BEFORE the legacy pivot effect, so the pivot offsets land afterwards.
//
// Measured in WORLD space only, for the reason documented at length in
// verify_subset_spin_pivot.js.

const THREE = require('three');

const PROP_WORLD = new THREE.Vector3(520, 40, -310);
const HUB_WORLD = new THREE.Vector3(520, 22, -310);

function computeLocalBoundingBox(root) {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tmp = new THREE.Box3();
  const rel = new THREE.Matrix4();
  root.traverse((o) => {
    if (o.isMesh && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox);
      rel.multiplyMatrices(inv, o.matrixWorld);
      tmp.applyMatrix4(rel);
      box.union(tmp);
    }
  });
  return box;
}

function detectDominantAxis(box) {
  const s = box.getSize(new THREE.Vector3());
  return [
    { v: s.x, vec: new THREE.Vector3(1, 0, 0) },
    { v: s.y, vec: new THREE.Vector3(0, 1, 0) },
    { v: s.z, vec: new THREE.Vector3(0, 0, 1) },
  ].sort((a, b) => a.v - b.v)[0].vec;
}

function mesh(name, pos, size) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  m.name = name;
  m.position.copy(pos);
  return m;
}

function build() {
  const scene = new THREE.Scene();
  const pivot = new THREE.Group(); pivot.name = 'pivot';
  const spin = new THREE.Group(); spin.name = 'spin';
  const spinSubset = new THREE.Group(); spinSubset.name = 'spinSubset';
  const group = new THREE.Group(); group.name = 'group';        // <primitive>
  const rootWrapper = new THREE.Group(); rootWrapper.name = 'rootWrapper';

  rootWrapper.add(mesh('prop', PROP_WORLD, [180, 6, 180]));
  rootWrapper.add(mesh('hub', HUB_WORLD, [30, 24, 30]));

  scene.add(pivot); pivot.add(spin);
  spin.add(spinSubset);
  spin.add(group); group.add(rootWrapper);
  scene.updateMatrixWorld(true);
  return { scene, pivot, spin, spinSubset, group, rootWrapper };
}

function worldOf(scene, name) {
  let f = null;
  scene.traverse((o) => { if (o.name === name) f = o; });
  const v = new THREE.Vector3();
  f.getWorldPosition(v);
  return v;
}

// --- the legacy pivot effect, verbatim in behaviour -------------------
function applyPivotEffect(ctx) {
  const box = computeLocalBoundingBox(ctx.rootWrapper);
  const center = box.getCenter(new THREE.Vector3());
  ctx.pivot.position.copy(center);
  ctx.group.position.set(-center.x, -center.y, -center.z);
  ctx.scene.updateMatrixWorld(true);
}

// --- variant A: current shipped spin effect ---------------------------
function spinEffect_current(ctx) {
  const toSpin = ctx.rootWrapper.children.filter((c) => c.name === 'prop');
  ctx.spinSubset.position.set(0, 0, 0);
  ctx.spinSubset.quaternion.identity();
  toSpin.forEach((c) => ctx.spinSubset.attach(c));
  const box = computeLocalBoundingBox(ctx.spinSubset);
  ctx.spinSubset.position.copy(box.getCenter(new THREE.Vector3()));
  ctx.scene.updateMatrixWorld(true);
  return detectDominantAxis(box);
}

// --- variant B: restore the centroid compensation only ----------------
function spinEffect_compensated(ctx) {
  const toSpin = ctx.rootWrapper.children.filter((c) => c.name === 'prop');
  ctx.spinSubset.position.set(0, 0, 0);
  ctx.spinSubset.quaternion.identity();
  toSpin.forEach((c) => ctx.spinSubset.attach(c));
  const box = computeLocalBoundingBox(ctx.spinSubset);
  const center = box.getCenter(new THREE.Vector3());
  ctx.spinSubset.position.copy(center);
  toSpin.forEach((c) => c.position.sub(center));
  ctx.scene.updateMatrixWorld(true);
  return detectDominantAxis(box);
}

// --- variant C: position the group in WORLD terms, THEN attach --------
// attach() preserves each child's world transform, so if the group's
// origin is already parked on the subset's world centroid, three.js does
// the compensation itself and the result is immune to whatever ancestor
// transforms exist above it.
function spinEffect_worldFirst(ctx) {
  const toSpin = ctx.rootWrapper.children.filter((c) => c.name === 'prop');

  // Centroid in WORLD space, measured BEFORE any reparenting.
  const worldBox = new THREE.Box3();
  toSpin.forEach((c) => worldBox.expandByObject(c));
  const worldCentroid = worldBox.getCenter(new THREE.Vector3());

  ctx.spinSubset.quaternion.identity();
  ctx.spinSubset.position.set(0, 0, 0);
  ctx.spinSubset.updateWorldMatrix(true, false);
  // Convert the world centroid into spinSubset's PARENT's local space.
  const local = ctx.spinSubset.parent.worldToLocal(worldCentroid.clone());
  ctx.spinSubset.position.copy(local);
  ctx.spinSubset.updateWorldMatrix(true, false);

  toSpin.forEach((c) => ctx.spinSubset.attach(c));
  ctx.scene.updateMatrixWorld(true);

  const box = computeLocalBoundingBox(ctx.spinSubset);
  return detectDominantAxis(box);
}

function run(label, spinFn, pivotRunsAfter) {
  const ctx = build();
  const propBefore = worldOf(ctx.scene, 'prop').clone();
  const hubBefore = worldOf(ctx.scene, 'hub').clone();

  const axis = spinFn(ctx);
  if (pivotRunsAfter) applyPivotEffect(ctx);

  const propMount = worldOf(ctx.scene, 'prop').clone();
  const hubMount = worldOf(ctx.scene, 'hub').clone();

  let travel = 0;
  for (let i = 0; i < 8; i++) {
    ctx.spinSubset.rotateOnAxis(axis, Math.PI / 4);
    ctx.scene.updateMatrixWorld(true);
    travel = Math.max(travel, worldOf(ctx.scene, 'prop').distanceTo(propMount));
  }
  const hubEnd = worldOf(ctx.scene, 'hub').clone();

  return {
    label,
    propJump: +propBefore.distanceTo(propMount).toFixed(4),
    hubJump: +hubBefore.distanceTo(hubMount).toFixed(4),
    hubDriftDuringSpin: +hubMount.distanceTo(hubEnd).toFixed(4),
    propWorldTravel: +travel.toFixed(4),
    propHubGapBefore: +propBefore.distanceTo(hubBefore).toFixed(2),
    propHubGapAfter: +propMount.distanceTo(hubMount).toFixed(2),
  };
}

// --- variant D: spin group created INSIDE rootWrapper -----------------
// The residual ~606 separation in B and C is not a maths error: it is
// structural. spinSubsetRef is a SIBLING of the model primitive, so the
// pivot effect's -center offset lands on the hub (inside the primitive)
// but never on the reparented propeller. Putting the spin group inside
// rootWrapper means it sits under the exact same ancestor chain as the
// hub, and every ancestor transform applies identically to both. The
// group is then parked on the subset's centroid so rotation pivots
// there, and attach() preserves each child's world position.
function spinEffect_insideRootWrapper(ctx) {
  const toSpin = ctx.rootWrapper.children.filter((c) => c.name === 'prop');

  const spinGroup = new THREE.Group();
  spinGroup.name = '__spinSubset';
  ctx.rootWrapper.add(spinGroup);
  ctx.scene.updateMatrixWorld(true);

  // Measure the subset in rootWrapper's own local space by temporarily
  // hosting the children at the group's zero origin.
  toSpin.forEach((c) => spinGroup.attach(c));
  const box = computeLocalBoundingBox(spinGroup);
  const center = box.getCenter(new THREE.Vector3());
  spinGroup.position.copy(center);
  toSpin.forEach((c) => c.position.sub(center));
  ctx.scene.updateMatrixWorld(true);

  ctx.spinSubset = spinGroup;   // rotate THIS one
  return detectDominantAxis(box);
}

const variants = [
  ['A current (no compensation)', spinEffect_current],
  ['B compensated sub(center)', spinEffect_compensated],
  ['C world-first, then attach', spinEffect_worldFirst],
  ['D group inside rootWrapper', spinEffect_insideRootWrapper],
];

console.log('=== ITEM 3: full hierarchy, pivot effect INCLUDED ===\n');
console.log('True prop-hub gap in the source model: ' +
  PROP_WORLD.distanceTo(HUB_WORLD).toFixed(2) + ' units\n');

for (const [label, fn] of variants) {
  const r = run(label, fn, true);
  console.log(`--- ${label} ---`);
  console.log(`  prop jump on mount      : ${r.propJump}`);
  console.log(`  hub  jump on mount      : ${r.hubJump}`);
  console.log(`  hub  drift during spin  : ${r.hubDriftDuringSpin}`);
  console.log(`  prop world travel       : ${r.propWorldTravel}`);
  console.log(`  prop-hub gap  before/after : ${r.propHubGapBefore} -> ${r.propHubGapAfter}`);
  console.log('');
}

console.log('PASS CRITERIA: prop jump 0, hub jump 0, hub drift 0,');
console.log('prop-hub gap preserved, prop world travel <= blade radius (~90).');

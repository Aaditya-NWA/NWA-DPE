// path: cad-pipeline/verify_local_bbox_fix.js
const THREE = require('three');
const { NodeIO } = require('@gltf-transform/core');

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

async function main() {
  // Load the real propeller geometry into an actual THREE.BufferGeometry.
  const io = new NodeIO();
  const doc = await io.read('./glb_out/propeller_cw.glb');
  const mesh = doc.getRoot().listMeshes()[0];
  const prim = mesh.listPrimitives()[0];
  const posAcc = prim.getAttribute('POSITION');
  const positionArray = posAcc.getArray();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

  const threeMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  const rootWrapper = new THREE.Group();
  rootWrapper.add(threeMesh);

  // Mimic our real hierarchy: primitiveGroup(rootWrapper's parent) -> spinGroup -> pivotGroup -> ancestorGroup
  const primitiveGroup = new THREE.Group();
  primitiveGroup.add(rootWrapper);
  const spinGroup = new THREE.Group();
  spinGroup.add(primitiveGroup);
  const pivotGroup = new THREE.Group();
  pivotGroup.add(spinGroup);
  const ancestorGroup = new THREE.Group(); // simulates drei's <Center>/<Bounds>, OUTSIDE our control
  ancestorGroup.add(pivotGroup);

  console.log('=== Test 1: ancestor at identity (no offset) ===');
  ancestorGroup.position.set(0, 0, 0);
  ancestorGroup.updateMatrixWorld(true); // force propagation, like R3F's render loop does every frame
  const oldMethodBox1 = new THREE.Box3().setFromObject(rootWrapper);
  const newMethodBox1 = computeLocalBoundingBox(rootWrapper);
  console.log('OLD (world-space) center:', oldMethodBox1.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)));
  console.log('NEW (local-space) center:', newMethodBox1.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)));

  console.log('\n=== Test 2: ancestor offset by [50, 30, 10] (simulating <Center> having already applied a correction) ===');
  ancestorGroup.position.set(50, 30, 10);
  ancestorGroup.updateMatrixWorld(true); // force propagation, like R3F's render loop does every frame
  const oldMethodBox2 = new THREE.Box3().setFromObject(rootWrapper);
  const newMethodBox2 = computeLocalBoundingBox(rootWrapper);
  console.log('OLD (world-space) center:', oldMethodBox2.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)));
  console.log('NEW (local-space) center:', newMethodBox2.getCenter(new THREE.Vector3()).toArray().map(v => v.toFixed(2)));

  console.log('\n=== Verdict ===');
  const oldChanged = !oldMethodBox1.getCenter(new THREE.Vector3()).equals(oldMethodBox2.getCenter(new THREE.Vector3()));
  const newUnchanged = newMethodBox1.getCenter(new THREE.Vector3()).distanceTo(newMethodBox2.getCenter(new THREE.Vector3())) < 0.001;
  console.log('OLD method changed when ancestor moved:', oldChanged, oldChanged ? '(confirms the bug: contaminated by ancestor transform)' : '');
  console.log('NEW method stayed constant when ancestor moved:', newUnchanged, newUnchanged ? '(confirms the fix works)' : '(FIX DID NOT WORK)');
}

main();

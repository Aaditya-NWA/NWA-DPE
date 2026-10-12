import * as THREE from 'three';

// Thinnest bounding-box axis — the spin axis for disc-like rotor geometry.
export function detectDominantAxis(box: THREE.Box3): { axisName: 'x' | 'y' | 'z'; axisVector: THREE.Vector3 } {
  const size = box.getSize(new THREE.Vector3());
  const dims: { name: 'x' | 'y' | 'z'; value: number; vector: THREE.Vector3 }[] = [
    { name: 'x', value: size.x, vector: new THREE.Vector3(1, 0, 0) },
    { name: 'y', value: size.y, vector: new THREE.Vector3(0, 1, 0) },
    { name: 'z', value: size.z, vector: new THREE.Vector3(0, 0, 1) },
  ];
  dims.sort((a, b) => a.value - b.value);
  return { axisName: dims[0].name, axisVector: dims[0].vector };
}

// Bounds in root's own local space. setFromObject() would bake in ancestor transforms.
export function computeLocalBoundingBox(root: THREE.Object3D): THREE.Box3 {
  root.updateWorldMatrix(true, true);
  const rootWorldInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const box = new THREE.Box3();
  const tempBox = new THREE.Box3();
  const relativeMatrix = new THREE.Matrix4();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      tempBox.copy(mesh.geometry.boundingBox!);
      relativeMatrix.multiplyMatrices(rootWorldInverse, mesh.matrixWorld);
      tempBox.applyMatrix4(relativeMatrix);
      box.union(tempBox);
    }
  });

  return box;
}

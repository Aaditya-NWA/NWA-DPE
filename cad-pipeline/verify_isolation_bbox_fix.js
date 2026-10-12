// path: cad-pipeline/verify_isolation_bbox_fix.js
const THREE = require('three');

function buildMockAssembly() {
  const scene = new THREE.Group();
  const rootWrapper = new THREE.Group();
  scene.add(rootWrapper);
  for (let i = 0; i < 409; i++) {
    const geom = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const mesh = new THREE.Mesh(geom);
    mesh.name = `solid_${i}`;
    mesh.position.set((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000);
    rootWrapper.add(mesh);
  }
  return { scene, rootWrapper };
}

const TARGET_NAME = 'solid_7';

console.log('=== OLD approach: toggle .visible only ===');
{
  const { scene, rootWrapper } = buildMockAssembly();
  rootWrapper.children.forEach((c) => { c.visible = c.name === TARGET_NAME; });
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  console.log('Bounding box size (should be tiny, ~0.1):', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
  console.log('(If huge, the camera frames the whole assembly, not the isolated part - the bug.)');
}

console.log('');
console.log('=== NEW approach: physically remove non-target children ===');
{
  const { scene, rootWrapper } = buildMockAssembly();
  const toRemove = rootWrapper.children.filter((c) => c.name !== TARGET_NAME);
  toRemove.forEach((c) => rootWrapper.remove(c));
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  console.log('Bounding box size (should be tiny, ~0.1):', size.x.toFixed(2), size.y.toFixed(2), size.z.toFixed(2));
  console.log('Remaining children in rootWrapper:', rootWrapper.children.length, '(expect 1)');
}

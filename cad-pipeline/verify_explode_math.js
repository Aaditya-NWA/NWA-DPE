// path: cad-pipeline/verify_explode_math.js
const { NodeIO } = require('@gltf-transform/core');

function nodeWorldBBox(node) {
  // PoC-scope simplification: our export uses identity node transforms
  // (CAD vertex coordinates are already in assembly space), so local
  // accessor bounds double as world bounds here. Not a generic glTF
  // bbox walker — fine for this validation, not for production code.
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];

  function walk(n) {
    const mesh = n.getMesh();
    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        const [pmin, pmax] = [pos.getMin([]), pos.getMax([])];
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], pmin[i]);
          max[i] = Math.max(max[i], pmax[i]);
        }
      }
    }
    for (const child of n.listChildren()) walk(child);
  }
  walk(node);
  return { min, max, center: min.map((v, i) => (v + max[i]) / 2) };
}

async function main() {
  const io = new NodeIO();
  const doc = await io.read('./glb_out/axial_flux_motor_ASSEMBLY.glb');
  const scene = doc.getRoot().listScenes()[0];
  const rootWrapper = scene.listChildren()[0]; // "AxialFluxMotorConcept_200mm"
  const partGroups = rootWrapper.listChildren(); // CHASSIS, ROTORS, HUB, ...

  const overall = nodeWorldBBox(rootWrapper);
  const size = overall.max.map((v, i) => v - overall.min[i]);
  const maxDim = Math.max(...size);

  console.log('Overall assembly center:', overall.center.map(v => v.toFixed(3)));
  console.log('Overall assembly size:', size.map(v => v.toFixed(3)), '| maxDim:', maxDim.toFixed(3));
  console.log('Explode distance (maxDim * 0.7):', (maxDim * 0.7).toFixed(3));
  console.log('');
  console.log('Part groups found:', partGroups.length);
  console.log('');

  partGroups.forEach((part) => {
    const box = nodeWorldBBox(part);
    const dir = box.center.map((v, i) => v - overall.center[i]);
    const len = Math.sqrt(dir.reduce((a, v) => a + v * v, 0));
    const normalized = len < 1e-4 ? [0, 0, 0] : dir.map(v => v / len);
    console.log(
      `${part.getName().padEnd(24)} center=[${box.center.map(v => v.toFixed(2)).join(', ')}]` +
      ` dist-from-center=${len.toFixed(3)}` +
      ` direction=[${normalized.map(v => v.toFixed(2)).join(', ')}]`
    );
  });

  console.log('\n=== Which axis actually separates the parts? ===');
  const axisNames = ['X', 'Y', 'Z'];
  const centers = partGroups.map(p => nodeWorldBBox(p).center);
  axisNames.forEach((name, i) => {
    const vals = centers.map(c => c[i]);
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length;
    const variance = vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length;
    console.log(`  ${name}: values=[${vals.map(v => v.toFixed(1)).join(', ')}] variance=${variance.toFixed(2)}`);
  });
}

main();

// path: cad-pipeline/step_to_glb.js
const fs = require('fs');
const path = require('path');
const occtimportjs = require('occt-import-js')();
const { Document, NodeIO } = require('@gltf-transform/core');

const inputFile = process.argv[2];
const outputFile = process.argv[3];

/** occt-import-js exposes a reader per format. IGES was added here for the
 * AXOM hexacopter, whose GrabCAD snapshot ships IGES only — no STEP. It
 * produces the same mesh array shape, so everything downstream is
 * unchanged. */
function readCad(occt, file) {
  const ext = path.extname(file).toLowerCase();
  const content = fs.readFileSync(file);
  if (ext === '.igs' || ext === '.iges') return occt.ReadIgesFile(content, null);
  if (ext === '.brep') return occt.ReadBrepFile(content, null);
  return occt.ReadStepFile(content, null);
}

occtimportjs.then(async (occt) => {
  const result = readCad(occt, inputFile);

  if (!result.success) {
    console.error('CAD parse failed for', inputFile);
    process.exit(1);
  }

  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('scene');
  const rootNode = doc.createNode(path.basename(inputFile, path.extname(inputFile)));
  scene.addChild(rootNode);

  result.meshes.forEach((mesh, i) => {
    const prim = doc.createPrimitive();

    const posAccessor = doc.createAccessor().setType('VEC3')
      .setArray(new Float32Array(mesh.attributes.position.array)).setBuffer(buffer);
    prim.setAttribute('POSITION', posAccessor);

    if (mesh.attributes.normal) {
      const normAccessor = doc.createAccessor().setType('VEC3')
        .setArray(new Float32Array(mesh.attributes.normal.array)).setBuffer(buffer);
      prim.setAttribute('NORMAL', normAccessor);
    }

    const idxAccessor = doc.createAccessor().setType('SCALAR')
      .setArray(new Uint32Array(mesh.index.array)).setBuffer(buffer);
    prim.setIndices(idxAccessor);

    const mat = doc.createMaterial(mesh.name || `mat_${i}`);
    if (mesh.color) {
      mat.setBaseColorFactor([mesh.color[0], mesh.color[1], mesh.color[2], 1]);
    }
    mat.setRoughnessFactor(0.6);
    mat.setMetallicFactor(0.3);
    prim.setMaterial(mat);

    const meshDoc = doc.createMesh(mesh.name || `mesh_${i}`);
    meshDoc.addPrimitive(prim);

    const node = doc.createNode(mesh.name || `part_${i}`).setMesh(meshDoc);
    rootNode.addChild(node);
  });

  const io = new NodeIO();
  await io.write(outputFile, doc);

  const stats = fs.statSync(outputFile);
  console.log(`Wrote ${outputFile} — ${(stats.size / 1024).toFixed(1)} KB, ${result.meshes.length} mesh nodes`);
});

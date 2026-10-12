// path: cad-pipeline/test_step_convert.js
const fs = require('fs');
const path = require('path');
const occtimportjs = require('occt-import-js')();

const targetFile = process.argv[2];

occtimportjs.then((occt) => {
  const startTime = Date.now();
  const fileContent = fs.readFileSync(targetFile);
  const result = occt.ReadStepFile(fileContent, null);
  const elapsed = Date.now() - startTime;

  console.log('=== FILE:', path.basename(targetFile), '===');
  console.log('success:', result.success);
  console.log('parse time (ms):', elapsed);
  console.log('mesh count:', result.meshes ? result.meshes.length : 0);

  if (result.meshes) {
    let totalVerts = 0;
    let totalTris = 0;
    result.meshes.forEach((mesh, i) => {
      const vertCount = mesh.attributes.position.array.length / 3;
      const triCount = mesh.index.array.length / 3;
      totalVerts += vertCount;
      totalTris += triCount;
      console.log(`  mesh[${i}] name="${mesh.name}" verts=${vertCount} tris=${triCount} color=${JSON.stringify(mesh.color)} hasNormals=${!!mesh.attributes.normal}`);
    });
    console.log('TOTAL verts:', totalVerts, 'TOTAL tris:', totalTris);
  }

  if (result.root) {
    console.log('root node name:', result.root.name, 'children:', result.root.children ? result.root.children.length : 0);
  }
});

// path: cad-pipeline/inspect_glb_nodes.mjs
/**
 * Dumps the RUNTIME canonical keys and geometry bounds of every top-level
 * solid in a GLB. This is the first step for authoring metadata for any
 * new product — you cannot type `memberNodeKeys` by hand without it.
 *
 * WHY IT IS NOT ENOUGH TO READ THE RAW GLB NAMES (both bugs are recorded
 * in docs/MEMORY.md, and both silently produced metadata that matched
 * nothing at runtime):
 *   1. three.js rewrites names via PropertyBinding.sanitizeNodeName —
 *      periods and spaces are reserved in its animation property paths.
 *   2. GLTFLoader.createUniqueName appends `_1`, `_2`... to repeats,
 *      against one file-global registry walked in node-index order.
 * Both are replicated below, so the printed key is what Model.tsx will
 * actually tag onto userData.canonicalKey.
 *
 * SPATIAL DATA comes from each node's POSITION accessor min/max, which is
 * valid precisely because these CAD->GLB solids carry IDENTITY transforms
 * with the geometry baked into the vertices (MEMORY.md 2026-07-29) — node
 * positions are useless here, geometry bounds are not.
 *
 *   node cad-pipeline/inspect_glb_nodes.mjs public/models/axom_q4.glb
 *   node cad-pipeline/inspect_glb_nodes.mjs <glb> --json   # machine-readable
 */
import fs from 'node:fs';
import * as THREE from 'three';

const file = process.argv[2];
const asJson = process.argv.includes('--json');
if (!file) {
  console.error('usage: node cad-pipeline/inspect_glb_nodes.mjs <file.glb> [--json]');
  process.exit(1);
}

function readGltfJson(f) {
  const buf = fs.readFileSync(f);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${f}`);
  return JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

const gltf = readGltfJson(file);

const used = Object.create(null);
const runtimeNames = gltf.nodes.map((n) => {
  const s = THREE.PropertyBinding.sanitizeNodeName(n.name || '');
  if (s in used) return `${s}_${++used[s]}`;
  used[s] = 0;
  return s;
});

const rootIdx = gltf.scenes[gltf.scene ?? 0].nodes[0];
const nodes = gltf.nodes[rootIdx].children.map((nodeIdx, i) => {
  const name = runtimeNames[nodeIdx];
  const prim = gltf.meshes[gltf.nodes[nodeIdx].mesh].primitives[0];
  const acc = gltf.accessors[prim.attributes.POSITION];
  const [minX, minY, minZ] = acc.min;
  const [maxX, maxY, maxZ] = acc.max;
  return {
    i,
    key: `${THREE.PropertyBinding.sanitizeNodeName(name)}#${i}`,
    verts: acc.count,
    c: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  };
});

if (asJson) {
  console.log(JSON.stringify(nodes));
} else {
  const overall = nodes.reduce(
    (a, n) => {
      for (let d = 0; d < 3; d++) {
        a.min[d] = Math.min(a.min[d], n.c[d] - n.size[d] / 2);
        a.max[d] = Math.max(a.max[d], n.c[d] + n.size[d] / 2);
      }
      return a;
    },
    { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
  );
  const f = (v) => v.map((x) => x.toFixed(1).padStart(9)).join(' ');
  console.log(`${file}`);
  console.log(`${nodes.length} top-level solids, ${nodes.reduce((s, n) => s + n.verts, 0)} vertices`);
  console.log(`overall size  ${f(overall.max.map((v, d) => v - overall.min[d]))}`);
  console.log(`overall min   ${f(overall.min)}`);
  console.log('');
  console.log('  idx  key                                  verts        cx        cy        cz        sx        sy        sz');
  nodes.forEach((n) => {
    console.log(
      `  ${String(n.i).padStart(3)}  ${n.key.padEnd(36)} ${String(n.verts).padStart(6)} ${f(n.c)} ${f(n.size)}`,
    );
  });
}

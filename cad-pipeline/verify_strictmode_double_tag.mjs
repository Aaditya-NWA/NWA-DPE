// path: cad-pipeline/verify_strictmode_double_tag.mjs
/**
 * FALSIFIABLE PROOF for a SUSPECTED pre-existing defect in
 * src/components/Model.tsx (2026-07-30, feature-001).
 *
 * THE SUSPICION: the canonical-key tagging effect (Model.tsx:173-183)
 * carries no StrictMode guard, and its comment asserts none is needed
 * ("harmless to run twice"). That claim holds only if
 * `rootWrapper.children` is still the PRISTINE 409-element array on the
 * second pass. It is not: the isolation effect REMOVES children and the
 * spin effects REPARENT them, and both run before StrictMode re-invokes
 * the tagging effect against the same memoized clone.
 *
 * WHAT THIS SCRIPT DOES: replays the real effect ORDER from Model.tsx
 * against the REAL vtol_airframe.glb node names and the REAL authored
 * keys in public/metadata/vtol.json, with and without the proposed
 * userData guard.
 *
 * WHY IT CAN FAIL (the project's standing rule, MEMORY.md §5): the
 * metric is the count of surviving solids after pass 2. If the defect is
 * absent, the unguarded run returns the same count as the guarded run
 * and this script reports NO DEFECT. The two variants cannot return the
 * same number if the defect is real, so the check discriminates.
 *
 * NO BINARY DECODING: a .glb is a 12-byte header + JSON chunk + BIN
 * chunk; node names live in the JSON chunk. `three` is imported from the
 * repo-root node_modules (this file is .mjs precisely because three
 * 0.185 is ESM-only and cad-pipeline is otherwise CommonJS).
 *
 *   node cad-pipeline/verify_strictmode_double_tag.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLB = path.join(HERE, '..', 'public', 'models', 'vtol_airframe.glb');
const META = path.join(HERE, '..', 'public', 'metadata', 'vtol.json');

// ---------- read the GLB's JSON chunk (no binary decoding) ----------
function readGltfJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
}

/**
 * Reproduces GLTFLoader.createUniqueName: sanitize, then suffix `_N` on
 * every repeat, against ONE registry shared by the whole file. The root
 * node is registered first because it is node 0.
 */
function runtimeNames(gltf) {
  const used = Object.create(null);
  const unique = (raw) => {
    const s = THREE.PropertyBinding.sanitizeNodeName(raw || '');
    if (s in used) return `${s}_${++used[s]}`;
    used[s] = 0;
    return s;
  };
  return gltf.nodes.map((n) => unique(n.name));
}

const gltf = readGltfJson(GLB);
const names = runtimeNames(gltf);
const rootIdx = (gltf.scenes[gltf.scene ?? 0].nodes)[0];
const childIdx = gltf.nodes[rootIdx].children;
const childNames = childIdx.map((i) => names[i]);

// ---------- the two effects under test, copied from Model.tsx ----------
const canonicalPartKey = (name, index) => `${THREE.PropertyBinding.sanitizeNodeName(name)}#${index}`;

/** Model.tsx:176-183, plus the proposed guard behind a flag. */
function tagEffect(rootWrapper, { guarded }) {
  if (guarded) {
    if (rootWrapper.userData.__canonicalKeysTagged) return;
    rootWrapper.userData.__canonicalKeysTagged = true;
  }
  rootWrapper.children.forEach((child, i) => {
    child.userData.canonicalKey = canonicalPartKey(child.name, i);
  });
}

/** Model.tsx:214-231, verbatim logic. */
function isolationEffect(rootWrapper, visibleNodeNames) {
  if (!visibleNodeNames) return;
  const toRemove = rootWrapper.children.filter(
    (child) =>
      !child.userData.isSpinSubsetGroup &&
      !visibleNodeNames.has(child.userData.canonicalKey) &&
      !visibleNodeNames.has(child.name),
  );
  toRemove.forEach((child) => rootWrapper.remove(child));
}

/** Model.tsx buildSpinGroup, reduced to its scene-graph mutation. */
function buildSpinGroup(rootWrapper, keys) {
  const toSpin = rootWrapper.children.filter(
    (c) => keys.has(c.userData.canonicalKey) || keys.has(c.name),
  );
  if (toSpin.length === 0) return null;
  const group = new THREE.Group();
  group.name = '__spinSubset';
  group.userData.isSpinSubsetGroup = true;
  rootWrapper.add(group);
  toSpin.forEach((child) => group.attach(child));
  return group;
}

function freshScene() {
  const rootWrapper = new THREE.Group();
  rootWrapper.name = names[rootIdx];
  childNames.forEach((n) => {
    const o = new THREE.Object3D();
    o.name = n;
    rootWrapper.add(o);
  });
  return rootWrapper;
}

// ---------- self-test: our key derivation must match authored data ----------
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const derived = new Set(childNames.map((n, i) => canonicalPartKey(n, i)));
const authored = new Set();
for (const [k, v] of Object.entries(meta.parts)) {
  authored.add(k);
  (v.memberNodeKeys ?? []).forEach((m) => authored.add(m));
  if (v.rig) [...v.rig.fixedNodeKeys, ...v.rig.spinningNodeKeys].forEach((m) => authored.add(m));
}
const missing = [...authored].filter((k) => !derived.has(k));
console.log(`children: ${childNames.length}   authored keys checked: ${authored.size}`);
if (missing.length) {
  console.error(`ABORT — key derivation is wrong, these authored keys match no node:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log('SELF-TEST PASS: every authored key resolves to exactly one runtime node.\n');

// ---------- SCENARIO A: detail view (isolation, no spin) ----------
// Real authored corner-prop rig: propeller + its hub bracket.
const visible = new Set(meta.parts['61-21-CCW#381'].memberNodeKeys);
console.log(`SCENARIO A — Detailed View isolation, visible set = ${[...visible].join(', ')}`);

const resultsA = {};
for (const guarded of [false, true]) {
  const root = freshScene();
  tagEffect(root, { guarded });          // pass 1
  isolationEffect(root, visible);
  const afterPass1 = root.children.length;
  tagEffect(root, { guarded });          // pass 2 — StrictMode re-invoke
  isolationEffect(root, visible);
  resultsA[guarded ? 'guarded' : 'unguarded'] = { afterPass1, afterPass2: root.children.length };
  console.log(
    `  ${guarded ? 'GUARDED  ' : 'UNGUARDED'}: survivors after pass 1 = ${afterPass1}, after pass 2 = ${root.children.length}`,
  );
}

// ---------- SCENARIO B: assembly screen with SPIN PROPS on ----------
const rigs = Object.values(meta.parts).filter((p) => p.rig);
console.log(`\nSCENARIO B — assembly + SPIN PROPS, ${rigs.length} rigs`);

const resultsB = {};
for (const guarded of [false, true]) {
  const root = freshScene();
  tagEffect(root, { guarded });          // pass 1
  const pass1Keys = new Map(root.children.map((c) => [c, c.userData.canonicalKey]));
  rigs.forEach((p) => buildSpinGroup(root, new Set(p.rig.spinningNodeKeys)));
  tagEffect(root, { guarded });          // pass 2 — StrictMode re-invoke
  let shifted = 0;
  root.children.forEach((c) => {
    if (pass1Keys.has(c) && pass1Keys.get(c) !== c.userData.canonicalKey) shifted += 1;
  });
  resultsB[guarded ? 'guarded' : 'unguarded'] = shifted;
  console.log(`  ${guarded ? 'GUARDED  ' : 'UNGUARDED'}: solids whose canonical key CHANGED on pass 2 = ${shifted}`);
}

// ---------- verdict ----------
console.log('\n--- VERDICT ---');
const defectA = resultsA.unguarded.afterPass2 !== resultsA.guarded.afterPass2;
const defectB = resultsB.unguarded > 0;
if (defectA || defectB) {
  console.log('DEFECT CONFIRMED. The unguarded tagging effect is NOT idempotent once the');
  console.log('scene graph has been mutated by the isolation / spin effects:');
  if (defectA) {
    console.log(`  A: Detailed View keeps ${resultsA.guarded.afterPass2} solids guarded, but ` +
      `${resultsA.unguarded.afterPass2} unguarded — isolation evicts re-keyed survivors.`);
  }
  if (defectB) {
    console.log(`  B: with SPIN PROPS on, ${resultsB.unguarded} solids get a DIFFERENT canonical key ` +
      `on pass 2 (guarded: ${resultsB.guarded}) — every click on those resolves to the wrong part.`);
  }
  console.log('\nThe guard (rootWrapper.userData.__canonicalKeysTagged) fixes both.');
} else {
  console.log('NO DEFECT: guarded and unguarded agree on both scenarios. The suspicion was wrong.');
}

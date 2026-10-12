// path: cad-pipeline/verify_sections_integrity.mjs
/**
 * GATE for the schema v3 `sections` block in public/metadata/vtol.json
 * (2026-07-30, feature-001). Run after ANY hand-edit to that block.
 *
 * Checks, against the REAL GLB and the REAL metadata:
 *   1. every authored member key matches exactly one runtime node key
 *   2. no node is claimed by two sections
 *   3. every solid is claimed by some section (no coverage regression)
 *   4. every rig's member nodes sit inside exactly ONE section
 *      (a rig split across two sections makes RPM CONTROL unreachable
 *      from one of them)
 *   5. each of the four propulsion pods contains exactly one rig part
 *   6. the section-isolation filter from Model.tsx, run with a real
 *      section's key set, leaves exactly that section's solids
 *
 * SELF-TEST (the project's standing rule — a validator that has never
 * been seen failing is not a validator): `--self-test` re-runs the same
 * checks against four deliberately corrupted copies of the metadata (a
 * typo'd key, a key duplicated into a second section, a rig split across
 * two sections, a solid dropped from every section) and FAILS if any of
 * them passes.
 *
 *   node cad-pipeline/verify_sections_integrity.mjs
 *   node cad-pipeline/verify_sections_integrity.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
/** Defaults to the VTOL, the asset this gate was written against and the
 *  only one carrying the self-test fixtures. Parameterised 2026-09-07 so
 *  the same six checks gate the three AXOM products' section blocks:
 *    node cad-pipeline/verify_sections_integrity.mjs <glb> <metadata.json>
 */
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const GLB = args[0] ? path.resolve(args[0]) : path.join(HERE, '..', 'public', 'models', 'vtol_airframe.glb');
const META = args[1] ? path.resolve(args[1]) : path.join(HERE, '..', 'public', 'metadata', 'vtol.json');
/**
 * Check 5 asserts exactly one rig per propulsion pod, which is what makes
 * the section-level RPM CONTROL shortcut unambiguous on the VTOL. It is
 * asserted only for sections listed here, and only when they exist in the
 * metadata being checked, because ONE RIG PER SECTION IS NOT A UNIVERSAL
 * RULE: an AXOM X8 rotor arm deliberately holds a coaxial PAIR. There the
 * shortcut correctly does not appear (rigPartsInSection returns 2, so
 * App's sectionRigKey stays null) and the user taps the specific rotor
 * they mean — which is the right answer when a section has two.
 */
const POD_SECTIONS = [
  'section:pod-fwd-zpos', 'section:pod-fwd-zneg',
  'section:pod-aft-zpos', 'section:pod-aft-zneg',
];

function readGltfJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  return JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

/** Runtime canonical keys, exactly as Model.tsx mints them. */
function runtimeKeys() {
  const gltf = readGltfJson(GLB);
  const used = Object.create(null);
  const names = gltf.nodes.map((n) => {
    const s = THREE.PropertyBinding.sanitizeNodeName(n.name || '');
    if (s in used) return `${s}_${++used[s]}`;
    used[s] = 0;
    return s;
  });
  const rootIdx = gltf.scenes[gltf.scene ?? 0].nodes[0];
  return gltf.nodes[rootIdx].children.map((nodeIdx, i) => ({
    name: names[nodeIdx],
    key: `${THREE.PropertyBinding.sanitizeNodeName(names[nodeIdx])}#${i}`,
  }));
}

/** Model.tsx's isolation filter, verbatim in logic. */
function isolate(children, visible) {
  return children.filter(
    (c) => visible.has(c.key) || visible.has(c.name),
  );
}

function check(meta, nodes) {
  const failures = [];
  const realKeys = new Set(nodes.map((n) => n.key));
  const sections = meta.sections ?? {};

  // 1 + 2: keys resolve, and nothing is double-claimed.
  const owner = new Map();
  for (const [id, sec] of Object.entries(sections)) {
    if (!id.startsWith('section:')) failures.push(`section id "${id}" lacks the section: prefix`);
    for (const key of sec.memberNodeKeys) {
      if (!realKeys.has(key)) failures.push(`${id}: member key "${key}" matches no runtime node`);
      if (owner.has(key)) failures.push(`node "${key}" claimed by both ${owner.get(key)} and ${id}`);
      owner.set(key, id);
    }
  }

  // 3: coverage — every solid is claimed by some section.
  //
  // THIS WAS A TAUTOLOGY UNTIL 2026-08-04. It read
  //   if (covered + (nodes.length - covered) !== nodes.length) ...
  // i.e. `x + (n - x) !== n`, which is false for every possible input, so
  // it could never fire; `uncovered` was computed and printed but never
  // asserted. Coverage happened to be 409/409, so nothing was wrong with
  // the DATA — but the check protecting it could not fail, which is
  // precisely the blind spot CLAUDE.md invariant 2 exists for. Found
  // while relying on this gate's coverage claim in a docs write-up.
  //
  // Partial coverage is TOLERABLE AT RUNTIME — an unclaimed solid falls
  // back to the v2 part panel tagged UNSECTIONED, deliberately, so no
  // click is ever dead — but it is an authoring regression, so this gate
  // treats it as a failure rather than a printed note.
  const covered = nodes.filter((n) => owner.has(n.key)).length;
  const uncovered = nodes.length - covered;
  if (uncovered > 0) failures.push(`${uncovered} of ${nodes.length} solids belong to no section`);

  // 4: each rig inside exactly one section.
  const rigsBySection = {};
  for (const [partKey, info] of Object.entries(meta.parts)) {
    if (!info.rig) continue;
    const members = info.memberNodeKeys ?? [partKey];
    const owners = new Set(members.map((m) => owner.get(m)));
    if (owners.size !== 1 || owners.has(undefined)) {
      failures.push(`rig "${partKey}" spans ${owners.size} section(s): ${[...owners].join(', ')}`);
    } else {
      (rigsBySection[[...owners][0]] ??= []).push(partKey);
    }
  }

  // 5: exactly one rig per pod, where pods exist — see POD_SECTIONS.
  for (const id of POD_SECTIONS) {
    if (!sections[id]) continue;
    const n = (rigsBySection[id] ?? []).length;
    if (n !== 1) failures.push(`${id} holds ${n} rig part(s), expected exactly 1`);
  }

  // 6: isolation really yields the section, using Model.tsx's own filter.
  for (const [id, sec] of Object.entries(sections)) {
    const survivors = isolate(nodes, new Set(sec.memberNodeKeys));
    if (survivors.length !== sec.memberNodeKeys.length) {
      failures.push(`${id}: isolation leaves ${survivors.length} solids, authored ${sec.memberNodeKeys.length}`);
    }
  }

  return { failures, covered, uncovered, sectionCount: Object.keys(sections).length, rigsBySection };
}

// ------------------------------------------------------------ real run
const nodes = runtimeKeys();
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const r = check(meta, nodes);

console.log(`GLB top-level solids : ${nodes.length}`);
console.log(`sections authored    : ${r.sectionCount}`);
console.log(`solids covered       : ${r.covered}`);
console.log(`solids uncovered     : ${r.uncovered}`);
console.log('rig containment      :');
for (const [sec, parts] of Object.entries(r.rigsBySection)) console.log(`  ${sec.padEnd(32)} ${parts.join(', ')}`);

if (r.failures.length) {
  console.error('\nFAILED:');
  r.failures.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log('\nPASS: all six checks.');

// ------------------------------------------------------------ self-test
if (process.argv.includes('--self-test')) {
  // The mutation fixtures name real VTOL sections and a real VTOL node,
  // so they only mean anything against that file. Running them against
  // another product would throw on an undefined section and read as a
  // gate failure rather than what it is: the wrong fixtures.
  if (!meta.sections?.['section:empennage']) {
    console.log('\nSELF-TEST SKIPPED — its fixtures are authored against vtol.json. Run it with no arguments.');
    process.exit(0);
  }
  console.log('\nSELF-TEST — each mutation below MUST be caught:');
  const clone = () => JSON.parse(JSON.stringify(meta));
  const mutations = [
    ['typo in a member key', (m) => {
      const s = m.sections['section:empennage'];
      s.memberNodeKeys[0] = `${s.memberNodeKeys[0]}_TYPO`;
    }],
    ['key duplicated into a second section', (m) => {
      m.sections['section:empennage'].memberNodeKeys.push(m.sections['section:wing-zpos'].memberNodeKeys[0]);
    }],
    ['rig split across two sections', (m) => {
      const pod = m.sections['section:pod-fwd-zpos'];
      const moved = pod.memberNodeKeys.splice(pod.memberNodeKeys.indexOf('part_385#385'), 1);
      m.sections['section:empennage'].memberNodeKeys.push(...moved);
    }],
    // Guards check 3, which was a tautology until 2026-08-04 and would
    // have let this through. Dropping a member leaves every other check
    // satisfied — the key set stays valid, nothing is double-claimed, and
    // isolation still matches the (now shorter) authored list — so only a
    // real coverage assertion catches it.
    ['a solid dropped from every section', (m) => {
      m.sections['section:empennage'].memberNodeKeys.pop();
    }],
  ];
  let missed = 0;
  for (const [label, mutate] of mutations) {
    const m = clone();
    mutate(m);
    const res = check(m, nodes);
    const caught = res.failures.length > 0;
    console.log(`  ${caught ? 'CAUGHT ' : 'MISSED '} ${label}${caught ? ` (${res.failures[0]})` : ''}`);
    if (!caught) missed += 1;
  }
  if (missed) {
    console.error(`\nSELF-TEST FAILED: ${missed} mutation(s) went undetected — these checks cannot be trusted.`);
    process.exit(1);
  }
  console.log('SELF-TEST PASS: every deliberate corruption was detected.');
}

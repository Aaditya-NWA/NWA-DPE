// path: cad-pipeline/generate_vtol_sections.mjs
/**
 * ONE-TIME OFFLINE GENERATOR for the schema v3 `sections` block in
 * public/metadata/vtol.json (2026-07-30, feature-001).
 *
 * WHY THIS EXISTS AS AN OFFLINE STEP, not runtime logic: the app must do
 * ZERO geometry or name heuristics — section membership is authored data,
 * exactly like `parts`. But 264 of the 409 solids are named `part_NNN`
 * (NNN == index, i.e. no information at all) and only 92 carry CAD part
 * numbers, so the membership lists cannot be typed by hand from names.
 * They are generated ONCE here from geometry, reviewed against the
 * evidence table this prints, pasted into vtol.json, and then hand-edited
 * for displayName/description. After that the JSON is the source of truth
 * and any single node can be moved between sections by hand.
 *
 * WHY RULES AND NOT CLUSTERING: measured, not assumed — single-linkage
 * clustering on centroids collapses at every threshold because fastener
 * rows chain boom -> wing root -> pod mount, leaving two 86/93-node blobs
 * spanning the entire aircraft. Explicit hand-chosen regions are what
 * separate them, so the region rules are recorded per section in
 * `derivedFrom` as provenance.
 *
 * SPATIAL DATA SOURCE: each node's POSITION accessor min/max from the
 * GLB's JSON chunk. Valid precisely because these STEP->GLB solids have
 * IDENTITY transforms with geometry baked into the vertices (MEMORY.md
 * 2026-07-29) — node positions are useless, geometry bounds are not.
 * No binary decoding, no vertex iteration.
 *
 *   node cad-pipeline/generate_vtol_sections.mjs           # evidence table
 *   node cad-pipeline/generate_vtol_sections.mjs --emit    # + JSON block
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLB = path.join(HERE, '..', 'public', 'models', 'vtol_airframe.glb');
const META = path.join(HERE, '..', 'public', 'metadata', 'vtol.json');
const EMIT = process.argv.includes('--emit');

// ---------------------------------------------------------------- read
function readGltfJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  return JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

const gltf = readGltfJson(GLB);

/** GLTFLoader.createUniqueName: sanitize, then `_N` per repeat, against
 *  one file-global registry, in node-index order (root is node 0). */
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
  const acc = gltf.accessors[gltf.meshes[gltf.nodes[nodeIdx].mesh].primitives[0].attributes.POSITION];
  const [minX, minY, minZ] = acc.min;
  const [maxX, maxY, maxZ] = acc.max;
  return {
    i,
    name,
    key: `${THREE.PropertyBinding.sanitizeNodeName(name)}#${i}`,
    min: [minX, minY, minZ],
    max: [maxX, maxY, maxZ],
    c: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    size: [maxX - minX, maxY - minY, maxZ - minZ],
  };
});

// ------------------------------------------------- self-test (aborting)
const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
const derived = new Set(nodes.map((n) => n.key));
const authored = new Set();
for (const [k, v] of Object.entries(meta.parts)) {
  authored.add(k);
  (v.memberNodeKeys ?? []).forEach((m) => authored.add(m));
  if (v.rig) [...v.rig.fixedNodeKeys, ...v.rig.spinningNodeKeys].forEach((m) => authored.add(m));
}
const unresolved = [...authored].filter((k) => !derived.has(k));
if (unresolved.length) {
  console.error('ABORT — key derivation is wrong; these authored keys match no node:');
  unresolved.forEach((k) => console.error(`  ${k}`));
  process.exit(1);
}
console.log(`${nodes.length} top-level solids; all ${authored.size} authored keys resolve. Units: mm.`);
console.log('Axes: X longitudinal (+fwd), Y vertical (+up), Z span (+/- symmetric).\n');

// ----------------------------------------------------------- the rules
// ORDERED, FIRST MATCH WINS. Each rule's `why` becomes `derivedFrom` in
// the emitted JSON, so a future session can tell a generated row from a
// deliberate hand-edit.
const POD = 250;          // half-window around a pod centre
const X_FWD = 1089.8;     // forward pod X (measured)
const X_AFT = -450.2;     // aft pod X (measured)
const Z_POD = 500;        // pod offset along span (measured)
const CENTRELINE_RIG = [356, 373, 374, 375, 357, 361, 372, 362];
/**
 * A pod's largest member is the propeller at 563mm. Two 606x464x515
 * structural solids (#346/#347) have centroids inside the aft Z+ pod
 * window but are plainly aircraft structure, not pod hardware — a
 * centroid test alone put them there and made that pod 29 nodes instead
 * of the 27 every other pod has. Requiring the solid to be pod-sized
 * too is what keeps the four pods identical.
 */
const POD_MAX_SOLID = 600;
const podTest = (n, x, z) =>
  Math.abs(n.c[0] - x) <= POD &&
  Math.abs(n.c[2] - z) <= POD &&
  Math.max(...n.size) <= POD_MAX_SOLID;

const rules = [
  {
    id: 'section:pod-fwd-zpos',
    displayName: 'Propulsion Pod — Front Right',
    description: 'Front-right propulsion pod: lift propeller, hub, spinner disc, ESC, motor mount and local boom structure.',
    why: `bbox centre within ±${POD}mm of (x=${X_FWD}, z=+${Z_POD}), solid ≤ ${POD_MAX_SOLID}mm`,
    test: (n) => podTest(n, X_FWD, Z_POD),
  },
  {
    id: 'section:pod-fwd-zneg',
    displayName: 'Propulsion Pod — Front Left',
    description: 'Front-left propulsion pod: lift propeller, hub, spinner disc, ESC, motor mount and local boom structure.',
    why: `bbox centre within ±${POD}mm of (x=${X_FWD}, z=−${Z_POD}), solid ≤ ${POD_MAX_SOLID}mm`,
    test: (n) => podTest(n, X_FWD, -Z_POD),
  },
  {
    id: 'section:pod-aft-zpos',
    displayName: 'Propulsion Pod — Rear Right',
    description: 'Rear-right propulsion pod: lift propeller, hub, spinner disc, ESC, motor mount and local boom structure.',
    why: `bbox centre within ±${POD}mm of (x=${X_AFT}, z=+${Z_POD}), solid ≤ ${POD_MAX_SOLID}mm`,
    test: (n) => podTest(n, X_AFT, Z_POD),
  },
  {
    id: 'section:pod-aft-zneg',
    displayName: 'Propulsion Pod — Rear Left',
    description: 'Rear-left propulsion pod: lift propeller, hub, spinner disc, ESC, motor mount and local boom structure.',
    why: `bbox centre within ±${POD}mm of (x=${X_AFT}, z=−${Z_POD}), solid ≤ ${POD_MAX_SOLID}mm`,
    test: (n) => podTest(n, X_AFT, -Z_POD),
  },
  {
    id: 'section:propulsion-centreline',
    displayName: 'Centreline Propulsion',
    description: 'Fuselage-centreline propeller: two-blade rig, hub, spinner and its ESC. Spins about the longitudinal axis, unlike the four lift pods.',
    why: 'explicit node list (rig 356/373/374/375 plus centreline neighbours 357/361/372/362) — too few nodes to justify a region rule',
    test: (n) => CENTRELINE_RIG.includes(n.i),
  },
  {
    id: 'section:empennage',
    displayName: 'Empennage & Tail Structure',
    description: 'Aft tail group: vertical and horizontal surfaces, tail-boom termination and underside structure.',
    why: 'bbox centre x < −800 (aft of every boom and wing element)',
    test: (n) => n.c[0] < -800,
  },
  // Wings are ONE section per side, not banded inboard/outboard: the
  // inboard bands measured only 4 solids each, too small to be worth a
  // separate screen. Never one section across both wings — that would
  // isolate two disconnected blobs 4.4m apart and frame the detail
  // camera on empty air between them.
  {
    id: 'section:wing-zpos',
    displayName: 'Right Wing',
    description: 'Right wing panel from the boom junction out to the wingtip, including spars and skins.',
    why: 'bbox centre z ≥ +700',
    test: (n) => n.c[2] >= 700,
  },
  {
    id: 'section:wing-zneg',
    displayName: 'Left Wing',
    description: 'Left wing panel from the boom junction out to the wingtip, including spars and skins.',
    why: 'bbox centre z ≤ −700',
    test: (n) => n.c[2] <= -700,
  },
  {
    id: 'section:boom-zpos-fwd',
    displayName: 'Right Boom — Forward',
    description: 'Forward half of the right-hand longitudinal boom and its attachment hardware.',
    why: 'bbox centre z > +300 and x ≥ +300',
    test: (n) => n.c[2] > 300 && n.c[0] >= 300,
  },
  {
    id: 'section:boom-zpos-aft',
    displayName: 'Right Boom — Rear',
    description: 'Rear half of the right-hand longitudinal boom and its attachment hardware.',
    why: 'bbox centre z > +300 (x < +300 after the forward rule)',
    test: (n) => n.c[2] > 300,
  },
  {
    id: 'section:boom-zneg-fwd',
    displayName: 'Left Boom — Forward',
    description: 'Forward half of the left-hand longitudinal boom and its attachment hardware.',
    why: 'bbox centre z < −300 and x ≥ +300',
    test: (n) => n.c[2] < -300 && n.c[0] >= 300,
  },
  {
    id: 'section:boom-zneg-aft',
    displayName: 'Left Boom — Rear',
    description: 'Rear half of the left-hand longitudinal boom and its attachment hardware.',
    why: 'bbox centre z < −300 (x < +300 after the forward rule)',
    test: (n) => n.c[2] < -300,
  },
  // No landing-gear section: the y < −150 rule matched 0 solids once the
  // empennage rule had taken the underside structure at x ≈ −925. An
  // empty section is worse than no section, so it is not shipped.
  {
    id: 'section:aft-fuselage',
    displayName: 'Aft Fuselage',
    description: 'Rear fuselage structure between the aft propulsion pods and the empennage.',
    why: 'bbox centre x < −500, after the pod, wing and boom rules',
    test: (n) => n.c[0] < -500,
  },
  {
    id: 'section:fuselage-core',
    displayName: 'Fuselage Core',
    description: 'Central fuselage body, nose structure and centreline equipment bay.',
    why: 'everything remaining (|z| ≤ 300 after all preceding rules)',
    test: () => true,
  },
];

// --------------------------------------------------------- assign + report
const assigned = new Map();               // sectionId -> node[]
rules.forEach((r) => assigned.set(r.id, []));
nodes.forEach((n) => {
  const rule = rules.find((r) => r.test(n));
  assigned.get(rule.id).push(n);
});

const fam = (n) => {
  const m = n.name.match(/^(\d{2}-\d{2})/);
  if (m) return m[1];
  if (/^part_\d+$/.test(n.name)) return 'part_NNN';
  return 'hardware';
};
const fmt = (v) => (v < 0 ? '' : ' ') + v.toFixed(0).padStart(5);
const range = (list, axis) => {
  const lo = Math.min(...list.map((n) => n.min[axis]));
  const hi = Math.max(...list.map((n) => n.max[axis]));
  return `${fmt(lo)}..${fmt(hi)}`;
};

console.log('SECTION EVIDENCE TABLE');
console.log('='.repeat(112));
console.log(
  'section'.padEnd(32) + 'n'.padStart(4) + '  ' + 'X bbox'.padEnd(15) +
  '  ' + 'Y bbox'.padEnd(15) + '  ' + 'Z bbox'.padEnd(15) + '  name families',
);
console.log('-'.repeat(112));
let total = 0;
for (const r of rules) {
  const list = assigned.get(r.id);
  total += list.length;
  if (list.length === 0) {
    console.log(r.id.padEnd(32) + '   0   — EMPTY, delete this section rather than ship it');
    continue;
  }
  const families = {};
  list.forEach((n) => { families[fam(n)] = (families[fam(n)] ?? 0) + 1; });
  const famStr = Object.entries(families).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(
    r.id.padEnd(32) + String(list.length).padStart(4) + '  ' +
    range(list, 0).padEnd(15) + '  ' + range(list, 1).padEnd(15) + '  ' + range(list, 2).padEnd(15) + '  ' + famStr,
  );
}
console.log('-'.repeat(112));
console.log(`total assigned: ${total} of ${nodes.length}`);

// ---------------------------------------------- assertions (exit non-zero)
const problems = [];
if (total !== nodes.length) problems.push(`coverage: ${total} assigned, expected ${nodes.length}`);

const seen = new Map();
for (const [id, list] of assigned) {
  for (const n of list) {
    if (seen.has(n.key)) problems.push(`node ${n.key} claimed by both ${seen.get(n.key)} and ${id}`);
    seen.set(n.key, id);
  }
}

// Every rig must sit inside exactly ONE section, or RPM CONTROL becomes
// unreachable from one of them.
for (const [partKey, info] of Object.entries(meta.parts)) {
  if (!info.rig) continue;
  const members = info.memberNodeKeys ?? [partKey];
  const owners = new Set(members.map((m) => seen.get(m)));
  if (owners.size !== 1) {
    problems.push(`rig "${partKey}" spans ${owners.size} sections: ${[...owners].join(', ')}`);
  }
}

// Each of the 4 pods must hold exactly one authored propeller part.
const rigPartsBySection = {};
for (const [partKey, info] of Object.entries(meta.parts)) {
  if (!info.rig) continue;
  const owner = seen.get((info.memberNodeKeys ?? [partKey])[0]);
  (rigPartsBySection[owner] ??= []).push(partKey);
}
console.log('\nRIG CONTAINMENT');
for (const [sec, parts] of Object.entries(rigPartsBySection)) {
  console.log(`  ${sec.padEnd(32)} ${parts.join(', ')}`);
}
for (const id of ['section:pod-fwd-zpos', 'section:pod-fwd-zneg', 'section:pod-aft-zpos', 'section:pod-aft-zneg']) {
  const n = (rigPartsBySection[id] ?? []).length;
  if (n !== 1) problems.push(`${id} holds ${n} rig parts, expected exactly 1`);
}

// Outliers: a solid far larger than the section it landed in is probably
// a spar or boom tube that a centroid rule put in the wrong place.
console.log('\nEXTENT OUTLIERS (solid spans >40% of its section along an axis — check by hand)');
let outliers = 0;
for (const [id, list] of assigned) {
  if (list.length < 2) continue;
  const ext = [0, 1, 2].map((a) => Math.max(...list.map((n) => n.max[a])) - Math.min(...list.map((n) => n.min[a])));
  for (const n of list) {
    const worst = [0, 1, 2].filter((a) => ext[a] > 0 && n.size[a] / ext[a] > 0.4);
    if (worst.length) {
      outliers += 1;
      if (outliers <= 15) {
        console.log(`  ${id.padEnd(30)} #${String(n.i).padStart(3)} ${n.name.padEnd(26)} size ${n.size.map((s) => s.toFixed(0).padStart(5)).join(' ')}`);
      }
    }
  }
}
console.log(`  ${outliers} outlier(s)${outliers > 15 ? ' (first 15 shown)' : ''}`);

// `--list=<sectionId>` dumps one section's members, largest first — the
// tool used to spot a structural part that a centroid rule mis-filed.
const listArg = process.argv.find((a) => a.startsWith('--list='));
if (listArg) {
  const id = listArg.slice('--list='.length);
  const list = (assigned.get(id) ?? []).slice().sort((a, b) => Math.max(...b.size) - Math.max(...a.size));
  console.log(`\nMEMBERS OF ${id} (${list.length}), largest first`);
  list.forEach((n) => console.log(
    `  #${String(n.i).padStart(3)} ${n.name.padEnd(30)} c=${n.c.map((v) => v.toFixed(0).padStart(6)).join(',')}  size=${n.size.map((v) => v.toFixed(0).padStart(5)).join(',')}`,
  ));
}

if (problems.length) {
  console.error('\nFAILED:');
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log('\nALL ASSERTIONS PASS: full coverage, no double-claim, every rig in exactly one section, one rig per pod.');

// ------------------------------------------------------------- emit JSON
if (EMIT) {
  const out = {};
  for (const r of rules) {
    const list = assigned.get(r.id);
    if (!list.length) continue;
    out[r.id] = {
      displayName: r.displayName,
      description: `${r.description} ${list.length} solids.`,
      derivedFrom: r.why,
      memberNodeKeys: list.map((n) => n.key),
    };
  }
  const file = path.join(HERE, 'vtol_sections.generated.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${Object.keys(out).length} sections to ${file}`);
}

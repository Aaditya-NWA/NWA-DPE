// path: cad-pipeline/generate_axom_sections.mjs
/**
 * ONE-TIME OFFLINE GENERATOR for the schema v3 `sections` block of the
 * three AXOM products (2026-09-07, feature-003-dpe-v1.1). Same role as
 * generate_vtol_sections.mjs, and the same reason for existing: section
 * membership is AUTHORED DATA that the runtime looks up, never something
 * the app derives — Model.tsx does zero geometry or name heuristics.
 *
 * WHY THE RULE IS RADIAL HERE AND REGIONAL ON THE VTOL: a multirotor's
 * natural sections ARE its rotor arms, and the rotor centres are already
 * known — they are the authored rigs. So each solid joins the nearest
 * rotor axis in the XZ plane if it lies within that product's claim
 * radius, and everything left over is split by an explicit core rule.
 * The VTOL needed hand-chosen regions because clustering provably could
 * not separate its port/starboard boom blobs; that problem does not
 * arise on a radially symmetric airframe.
 *
 * The claim radius per product is not a guess — it is chosen against the
 * evidence table this prints, and the numbers behind each choice are in
 * docs/MEMORY.md. The test is that every arm boom lands in its own rotor
 * section while nothing central does.
 *
 * SPATIAL DATA is each node's POSITION accessor min/max, valid because
 * these CAD->GLB solids carry IDENTITY transforms with geometry baked
 * into the vertices (MEMORY.md 2026-07-29).
 *
 *   node cad-pipeline/generate_axom_sections.mjs            # evidence table
 *   node cad-pipeline/generate_axom_sections.mjs --emit     # + JSON blocks
 *   node cad-pipeline/generate_axom_sections.mjs --write    # patch the JSON files
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODELS = path.join(HERE, '..', 'public', 'models');
const META = path.join(HERE, '..', 'public', 'metadata');
const EMIT = process.argv.includes('--emit');
const WRITE = process.argv.includes('--write');

/**
 * Per-product rules. `claimRadius` is in model units (millimetres for all
 * three of these). `core` is ordered — the first matching rule wins, and
 * the last rule must match everything so no solid is left unclaimed.
 */
const PRODUCTS = [
  {
    id: 'axom_q4',
    glb: 'axom_q4.glb',
    // Rotors sit 120 from centre and 170 from each other; an arm boom's
    // centroid sits 42 from its own rotor. 70 claims every boom and its
    // motor hardware while leaving the 15-unit-radius centre stack alone.
    claimRadius: 70,
    core: [
      { id: 'section:power', displayName: 'Power Bay', description: 'Flight battery and its mounting face on the upper frame plate.', match: (n) => /Battery/.test(n.key) },
      { id: 'section:avionics', displayName: 'Avionics Stack', description: 'Flight controller, radio, power distribution boards and the four speed controllers, stacked between the frame plates.', match: (n) => /Distribution_Board|Electrical_Unit|Electrical_Connector/.test(n.key) },
      { id: 'section:frame', displayName: 'Centre Frame', description: 'The plate sandwich every arm and every load path passes through, with its standoffs and fasteners.', match: () => true },
    ],
  },
  {
    id: 'axom_x8',
    glb: 'axom_x8.glb',
    // Arms sit 254 from centre and 359 apart. 140 claims each lateral
    // tube half and the whole coaxial nacelle, and stops short of the
    // landing legs, whose nearest arm is 155 away.
    claimRadius: 140,
    core: [
      { id: 'section:landing-gear', displayName: 'Landing Gear', description: 'Four vertical legs, their frame brackets and the two angled skids that spread touchdown load into the airframe.', match: (n) => /truba10_200|ugolok350|kronshteyn/.test(n.key) || n.c[1] < 60 },
      { id: 'section:power', displayName: 'Power Bay', description: 'Twin lithium-polymer packs and their brackets, mounted symmetrically either side of the centre plate.', match: (n) => /LiPo|accu_kronsht/.test(n.key) },
      { id: 'section:avionics', displayName: 'Avionics Stack', description: 'Autopilot, GNSS receiver, telemetry radio, speed controllers and the power distribution plate.', match: (n) => /apm2_5|GPS|gps_plate|radio|^esc|power_plate/.test(n.key) },
      { id: 'section:frame', displayName: 'Centre Frame', description: 'Spine tube, centre plate and the clamp hardware holding the cruciform together.', match: () => true },
    ],
  },
  {
    id: 'axom_h6',
    glb: 'axom_h6.glb',
    // Rotors sit 695 from centre. Each boom's centroid sits 312 from its
    // own rotor, and the nearest core solid (a landing leg) is 437 away,
    // so 400 separates them cleanly with margin either side.
    claimRadius: 400,
    // This airframe came from IGES and carries NO part names at all, so
    // core rules are index ranges read off the evidence table rather than
    // name matches. Recorded here because that is the only place the
    // reasoning survives.
    core: [
      { id: 'section:sensor', displayName: 'Sensor & Gimbal', description: 'Stabilised gimbal, imaging payload and the GNSS mast above the airframe.', match: (n) => n.i >= 52 && n.i <= 54 },
      { id: 'section:landing-gear', displayName: 'Landing Gear', description: 'Tall twin legs, sized to give the underslung gimbal ground clearance.', match: (n) => n.i === 50 || n.i === 51 },
      { id: 'section:avionics', displayName: 'Avionics & Payload Bay', description: 'Enclosed centre body carrying the autopilot, power stage and payload interface.', match: (n) => n.i >= 44 && n.i <= 49 },
      { id: 'section:frame', displayName: 'Centre Frame', description: 'Upper and lower centre plates and the twelve clamps that grip the six booms between them.', match: () => true },
    ],
  },
];

// ---------------------------------------------------------------- read
function readGltfJson(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${file}`);
  return JSON.parse(buf.slice(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
}

/** Replicates GLTFLoader.createUniqueName so the keys printed here are
 *  the ones Model.tsx will actually tag at runtime. */
function topLevelNodes(gltf) {
  const used = Object.create(null);
  const runtimeNames = gltf.nodes.map((n) => {
    const s = THREE.PropertyBinding.sanitizeNodeName(n.name || '');
    if (s in used) return `${s}_${++used[s]}`;
    used[s] = 0;
    return s;
  });
  const rootIdx = gltf.scenes[gltf.scene ?? 0].nodes[0];
  return gltf.nodes[rootIdx].children.map((nodeIdx, i) => {
    const acc = gltf.accessors[gltf.meshes[gltf.nodes[nodeIdx].mesh].primitives[0].attributes.POSITION];
    const [minX, minY, minZ] = acc.min;
    const [maxX, maxY, maxZ] = acc.max;
    return {
      i,
      key: `${THREE.PropertyBinding.sanitizeNodeName(runtimeNames[nodeIdx])}#${i}`,
      c: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    };
  });
}

// ------------------------------------------------------------- process
let failures = 0;

for (const product of PRODUCTS) {
  const metaPath = path.join(META, `${product.id}.json`);
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const nodes = topLevelNodes(readGltfJson(path.join(MODELS, product.glb)));
  const byKey = new Map(nodes.map((n) => [n.key, n]));

  console.log(`\n${'='.repeat(78)}\n${meta.productName}  —  ${nodes.length} solids, claim radius ${product.claimRadius}`);

  // Rotor anchors come from the AUTHORED rigs: the XZ centroid of each
  // rig's spinning subset. Coaxial rotors share an XZ position, so their
  // anchors merge into one arm section — which is the physical assembly.
  const anchors = [];
  for (const [partKey, part] of Object.entries(meta.parts)) {
    if (!part.rig) continue;
    const pts = part.rig.spinningNodeKeys.map((k) => byKey.get(k));
    if (pts.some((p) => !p)) {
      console.log(`  !! rig "${partKey}" references a key that is not in the GLB`);
      failures++;
      continue;
    }
    const x = pts.reduce((s, p) => s + p.c[0], 0) / pts.length;
    const z = pts.reduce((s, p) => s + p.c[2], 0) / pts.length;
    const existing = anchors.find((a) => Math.hypot(a.x - x, a.z - z) < 1);
    if (existing) { existing.parts.push(partKey); continue; }
    anchors.push({ x, z, parts: [partKey] });
  }

  // Section identity comes from the rig's own authored display name, so
  // the two can never drift: "Rotor 2 — Front Right" -> rotor-2. Coaxial
  // pairs collapse to the arm ("Rotor 1U"/"Rotor 1L" -> rotor-1).
  anchors.forEach((a) => {
    const first = meta.parts[a.parts[0]].displayName;
    const num = first.match(/Rotor\s*(\d+)/i)?.[1] ?? String(anchors.indexOf(a) + 1);
    const where = first.split('—')[1]?.trim().replace(/\s*(Upper|Lower)$/i, '') ?? '';
    a.id = `section:rotor-${num}`;
    a.displayName = a.parts.length > 1 ? `Rotor Arm ${num} — ${where}` : `Rotor Assembly ${num} — ${where}`;
    a.description = a.parts.length > 1
      ? `Coaxial rotor arm: two counter-rotating rotors on one axis, their motors, mounts and the boom carrying them.`
      : `Complete rotor assembly: boom, motor, mount hardware and the propeller it drives.`;
  });

  const buckets = new Map();
  const put = (id, key) => { if (!buckets.has(id)) buckets.set(id, []); buckets.get(id).push(key); };

  for (const n of nodes) {
    let best = null;
    let bestD = Infinity;
    for (const a of anchors) {
      const d = Math.hypot(a.x - n.c[0], a.z - n.c[2]);
      if (d < bestD) { bestD = d; best = a; }
    }
    if (best && bestD <= product.claimRadius) { put(best.id, n.key); continue; }
    put(product.core.find((r) => r.match(n)).id, n.key);
  }

  const defs = [
    ...anchors.map((a) => ({ id: a.id, displayName: a.displayName, description: a.description, derivedFrom: `nearest rotor axis within ${product.claimRadius} units of (${a.x.toFixed(1)}, ${a.z.toFixed(1)})` })),
    ...product.core.map((r) => ({ id: r.id, displayName: r.displayName, description: r.description, derivedFrom: `core rule: everything outside the rotor claim radius matching ${r.id}` })),
  ];

  const sections = {};
  for (const d of defs) {
    const members = buckets.get(d.id) ?? [];
    if (members.length === 0) {
      // An empty section is worse than no section — the same call made
      // for the VTOL's landing-gear rule (MEMORY.md 2026-07-30).
      console.log(`  -- ${d.id} matched 0 solids, dropped`);
      continue;
    }
    sections[d.id] = { displayName: d.displayName, description: d.description, memberNodeKeys: members, derivedFrom: d.derivedFrom };
  }

  const covered = Object.values(sections).reduce((s, v) => s + v.memberNodeKeys.length, 0);
  Object.entries(sections).forEach(([id, v]) => {
    console.log(`  ${String(v.memberNodeKeys.length).padStart(4)}  ${id.padEnd(26)} ${v.displayName}`);
  });
  console.log(`  ${String(covered).padStart(4)}  TOTAL (${nodes.length} solids in the GLB)`);

  if (covered !== nodes.length) { console.log('  !! COVERAGE MISMATCH'); failures++; }

  // Every rig must sit inside exactly one section, or RPM CONTROL is
  // unreachable from the section that half-owns it.
  for (const [partKey, part] of Object.entries(meta.parts)) {
    if (!part.rig) continue;
    const owners = new Set((part.memberNodeKeys ?? [partKey]).map((k) => Object.entries(sections).find(([, v]) => v.memberNodeKeys.includes(k))?.[0]));
    if (owners.size !== 1 || owners.has(undefined)) {
      console.log(`  !! rig "${partKey}" spans ${owners.size} section(s): ${[...owners].join(', ')}`);
      failures++;
    }
  }

  if (EMIT) console.log(`\n${JSON.stringify({ sections }, null, 2)}`);
  if (WRITE) {
    meta.sections = sections;
    fs.writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`  -> wrote sections into ${path.relative(path.join(HERE, '..'), metaPath)}`);
  }
}

console.log(`\n${failures === 0 ? 'OK — all products consistent' : `${failures} PROBLEM(S)`}\n`);
process.exit(failures === 0 ? 0 : 1);

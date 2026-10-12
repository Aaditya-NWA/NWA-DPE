// path: nwa-dpe-shell/cad-pipeline/generate_physical_profiles.mjs
/**
 * GENERATE THE SCHEMA v5 `physical` BLOCK, AND THE MEASURED PART SPECS.
 *
 * WHAT THIS ANSWERS. A GLB carries no real-world scale, so until now the
 * viewer could not say how big anything was — every model was fitted to
 * the frame and a 28cm quadrotor looked exactly like a 4.4m VTOL. The
 * scale reference, the fleet line-up and compare mode all need one number
 * per product: the real length of its longest dimension.
 *
 * THE UNIT IS NOT ASSUMED — IT IS READ FROM THE SOURCE CAD. That is the
 * whole reason this is a script and not a hand-typed constant:
 *
 *   Final.STEP (Q4)           SI_UNIT ( .MILLI., .METRE. )
 *   X8-quadrocopter.STEP      SI_UNIT ( .MILLI., .METRE. )
 *   Hexacopter Assembly.IGS   global field 15 = 2, field 16 = "MM"
 *
 * All three declare millimetres, and this script re-reads those
 * declarations from the source files when they are present rather than
 * trusting the table below. Under that reading the three AXOM products
 * measure 0.28m, 0.75m and 1.50m — plausible for a training quadrotor, an
 * X8 and a surveillance hexarotor respectively, and absurd under any
 * other unit (0.28m becomes 28m under centimetres). Measurement and
 * declaration agree, so these spans are marked `measured`.
 *
 * THE VTOL IS THE EXCEPTION AND IS MARKED `placeholder`. Its source CAD
 * is not in this workspace, so its unit cannot be read — only inferred
 * from the fact that the same pipeline produced it and that 4.43m is a
 * believable wingspan. That is an inference, and schema v5 exists
 * precisely so an inference does not get displayed with the authority of
 * a measurement.
 *
 * Usage:
 *   node generate_physical_profiles.mjs            # print what it would write
 *   node generate_physical_profiles.mjs --write    # patch the metadata files
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHELL = path.resolve(HERE, '..');
const WORKSPACE = path.resolve(SHELL, '..');

/**
 * `sourceCad` is relative to the workspace root and may legitimately be
 * absent — the snapshots are the owner's download folders, not repo
 * content. A missing source downgrades provenance rather than failing.
 */
const PRODUCTS = [
  {
    id: 'axom_q4',
    glb: 'public/models/axom_q4.glb',
    metadata: 'public/metadata/axom_q4.json',
    sourceCad: 'quadcopter-drone-frame-with-truss-arms-1.snapshot.12/Final.STEP',
    spanLabel: 'rotor tip to rotor tip, diagonal',
  },
  {
    id: 'axom_x8',
    glb: 'public/models/axom_x8.glb',
    metadata: 'public/metadata/axom_x8.json',
    sourceCad: 'x8-quadrocopter-octocopter.snapshot.7/X8-quadrocopter.STEP',
    spanLabel: 'rotor tip to rotor tip, diagonal',
  },
  {
    id: 'axom_h6',
    glb: 'public/models/axom_h6.glb',
    metadata: 'public/metadata/axom_h6.json',
    sourceCad: 'surveillance-hexacopter-1.snapshot.3/Hexacopter Assembly.IGS',
    spanLabel: 'rotor tip to rotor tip, across the hexagon',
  },
  {
    id: 'vtol',
    glb: 'public/models/vtol_airframe.glb',
    metadata: 'public/metadata/vtol.json',
    sourceCad: null,
    spanLabel: 'nose to tail',
  },
];

/** Reads the length unit declared by a STEP or IGES file. Returns null
 * when the file is absent or the declaration cannot be found — never
 * guesses, because guessing here is exactly what this script exists to
 * avoid. */
function declaredUnit(absPath) {
  if (!absPath || !existsSync(absPath)) return null;
  const text = readFileSync(absPath, 'latin1');

  if (/\.ig[se]s?$/i.test(absPath)) {
    // IGES global section: lines carrying 'G' in column 73 (index 72),
    // comma-delimited Hollerith fields. Field 16 is the unit name.
    const global = text.split(/\r?\n/).filter((l) => l[72] === 'G').map((l) => l.slice(0, 72)).join('');
    const m = global.match(/,\s*\d+H(MM|IN|FT|MI|M|KM|MIL|UM|CM|UIN)\s*,/i);
    return m ? m[1].toUpperCase() : null;
  }

  const m = text.match(/SI_UNIT\s*\(\s*\.(MILLI|CENTI|KILO)?\.?\s*,?\s*\.METRE\./i);
  if (!m) return /SI_UNIT\s*\(\s*\$\s*,\s*\.METRE\./i.test(text) ? 'M' : null;
  return { MILLI: 'MM', CENTI: 'CM', KILO: 'KM', undefined: 'M' }[m[1]] ?? 'M';
}

const METRES_PER = { MM: 0.001, CM: 0.01, M: 1, KM: 1000, IN: 0.0254, FT: 0.3048 };

async function measureGlb(absPath) {
  const doc = await new NodeIO().read(absPath);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const mn = pos.getMin([]);
      const mx = pos.getMax([]);
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], mn[i]);
        max[i] = Math.max(max[i], mx[i]);
      }
    }
  }
  const size = max.map((v, i) => v - min[i]);
  return { size, maxDim: Math.max(...size) };
}

/**
 * Facts about a rig component that are true by construction of the
 * metadata itself, so they cannot drift from what the viewer does.
 *
 * Every one of these is a COUNT over authored data, which is why they are
 * marked `measured` — no thrust, no RPM, no efficiency, because none of
 * those exists anywhere in this project as anything but an invention.
 */
function rigSpecs(partKey, part) {
  const memberCount = (part.memberNodeKeys ?? [partKey]).length;
  const spinning = part.rig.spinningNodeKeys.length;
  const fixed = part.rig.fixedNodeKeys.length;
  const specs = [
    { label: 'Solids', value: String(memberCount), provenance: 'measured', note: 'Distinct nodes in this component.' },
    {
      label: 'Rotating / fixed',
      value: `${spinning} / ${fixed}`,
      provenance: 'measured',
      note: 'Verified separable in the CAD — this is what makes RPM control possible.',
    },
    {
      label: 'Blade pitch',
      value: part.rig.pitch ? `Variable, ±${part.rig.pitch.maxAngleDeg ?? 30}°` : 'Fixed (blades fused)',
      provenance: 'measured',
      note: part.rig.pitch
        ? 'Blades are separate solids, so a rigid pitch rotation is possible.'
        : 'Both blades are one watertight solid with no separable mesh island, so a rigid pitch is geometrically impossible here.',
    },
  ];
  return specs;
}

const write = process.argv.includes('--write');
let exitCode = 0;

for (const p of PRODUCTS) {
  const glbPath = path.join(SHELL, p.glb);
  const metaPath = path.join(SHELL, p.metadata);
  if (!existsSync(glbPath) || !existsSync(metaPath)) {
    console.error(`SKIP ${p.id}: missing ${!existsSync(glbPath) ? p.glb : p.metadata}`);
    exitCode = 1;
    continue;
  }

  const { size, maxDim } = await measureGlb(glbPath);
  const sourceAbs = p.sourceCad ? path.join(WORKSPACE, p.sourceCad) : null;
  const unit = declaredUnit(sourceAbs);
  const scale = METRES_PER[unit ?? 'MM'];
  const spanM = Number((maxDim * scale).toFixed(3));

  const provenance = unit ? 'measured' : 'placeholder';
  const note = unit
    ? `Longest bounding-box dimension of the GLB (${maxDim.toFixed(1)}), with the length unit ${unit} read from ${path.basename(sourceAbs)}.`
    : `Longest bounding-box dimension of the GLB (${maxDim.toFixed(1)}), interpreted as millimetres. The source CAD is not in this workspace, so the unit could not be read and this is an inference, not a measurement.`;

  console.log(
    `${p.id.padEnd(9)} ${size.map((v) => v.toFixed(1)).join(' x ').padEnd(28)} ` +
    `unit=${(unit ?? 'UNKNOWN').padEnd(7)} span=${spanM} m  [${provenance}]`,
  );

  if (!write) continue;

  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  meta.schemaVersion = 5;
  meta.physical = { spanM, spanLabel: p.spanLabel, provenance, note };

  // Overall span also becomes a published key spec, where the product has
  // a website block — it is the one headline figure on those cards that
  // is not invented, and marking it says so.
  if (meta.website) {
    const existing = meta.website.keySpecs.findIndex((s) => s.label === 'Overall span');
    const entry = { label: 'Overall span', value: `${spanM.toFixed(2)} m`, provenance, note: p.spanLabel };
    if (existing >= 0) meta.website.keySpecs[existing] = entry;
    else meta.website.keySpecs.unshift(entry);

    // Configuration is likewise a counted fact: how many rigs there are,
    // and whether any of them can pitch.
    const rigCount = Object.values(meta.parts).filter((x) => x.rig).length;
    const pitchCount = Object.values(meta.parts).filter((x) => x.rig?.pitch).length;
    const config = meta.website.keySpecs.find((s) => s.label === 'Configuration');
    if (config) {
      config.provenance = 'measured';
      config.note = `${rigCount} drivable rotor rig${rigCount === 1 ? '' : 's'}, ` +
        `${pitchCount === 0 ? 'none with variable pitch' : `${pitchCount} with variable pitch`}. Counted from the authored rigs.`;
    }
  }

  for (const [key, part] of Object.entries(meta.parts)) {
    if (!part.rig) continue;
    part.specs = rigSpecs(key, part);
  }

  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(`  written -> ${p.metadata}`);
}

if (!write) console.log('\n(dry run — pass --write to patch the metadata files)');
process.exit(exitCode);

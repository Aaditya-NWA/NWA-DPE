// path: nwa-dpe-shell/cad-pipeline/verify_metadata_v5.mjs
/**
 * GATE FOR SCHEMA v5 — provenance, physical scale and scenarios.
 *
 * WHAT COULD GO WRONG HERE, which is what each check is for:
 *
 *  1. A FIGURE MARKED `measured` THAT NOBODY MEASURED. This is the only
 *     failure in schema v5 that actively misleads a customer rather than
 *     merely looking unfinished: the badge exists to be trusted, so a
 *     wrong badge is worse than no badge. A `measured` entry must carry a
 *     `note` saying where the measurement came from — an unexplained
 *     green tick is exactly the thing this schema was added to stop.
 *  2. A SCENARIO STEP POINTING AT A SECTION THAT DOES NOT EXIST. The
 *     playback engine looks the id up and gets undefined, so the tour
 *     silently shows an unhighlighted model for that step and nobody can
 *     tell it is broken — it just looks like a step that does nothing.
 *  3. A ZERO OR NEGATIVE `spanM`. The scale reference divides by the
 *     model's measured maxDim and multiplies by this; a zero produces a
 *     silent 0cm readout and the fleet view's margin arithmetic divides
 *     by it, producing Infinity and a blank canvas.
 *  4. AN EMPTY SPEC VALUE, which renders as a blank cell that reads as
 *     "we do not publish that" rather than as an authoring mistake.
 *
 * SELF-TEST. `--self-test` injects one instance of each of those four
 * defects into a synthetic metadata file and FAILS if any goes
 * undetected. Per the project's verification rule (docs/MEMORY.md §5): a
 * check is only worth running if you know what it would report when the
 * bug IS present, and this is how that is established.
 *
 * Usage:
 *   node verify_metadata_v5.mjs                 # gate every metadata file
 *   node verify_metadata_v5.mjs --self-test     # prove the checks can fail
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const METADATA_DIR = path.resolve(HERE, '../public/metadata');

const PROVENANCE = new Set(['measured', 'placeholder']);

/** Returns a list of problem strings. Empty means the file is clean. */
function checkFile(name, meta) {
  const problems = [];
  const sectionIds = new Set(Object.keys(meta.sections ?? {}));

  const checkSpec = (where, spec) => {
    if (typeof spec.label !== 'string' || spec.label.trim() === '') {
      problems.push(`${where}: spec has an empty label.`);
    }
    if (typeof spec.value !== 'string' || spec.value.trim() === '') {
      problems.push(`${where}: spec "${spec.label}" has an empty value — it will render as a blank cell.`);
    }
    if (spec.provenance !== undefined && !PROVENANCE.has(spec.provenance)) {
      problems.push(`${where}: spec "${spec.label}" has provenance "${spec.provenance}", which is neither 'measured' nor 'placeholder'.`);
    }
    if (spec.provenance === 'measured' && (typeof spec.note !== 'string' || spec.note.trim() === '')) {
      problems.push(`${where}: spec "${spec.label}" claims 'measured' but names no source. A measured badge with no provenance note is the one failure this schema exists to prevent.`);
    }
  };

  // --- 3. physical scale -------------------------------------------
  if (meta.physical) {
    const { spanM, spanLabel, provenance, note } = meta.physical;
    if (!Number.isFinite(spanM) || spanM <= 0) {
      problems.push(`physical.spanM is ${spanM}; the scale reference divides by it and the fleet view scales by it.`);
    }
    if (typeof spanLabel !== 'string' || spanLabel.trim() === '') {
      problems.push('physical.spanLabel is empty — the readout would not say what the dimension is.');
    }
    if (provenance !== undefined && !PROVENANCE.has(provenance)) {
      problems.push(`physical.provenance is "${provenance}", which is neither 'measured' nor 'placeholder'.`);
    }
    if (provenance === 'measured' && (typeof note !== 'string' || note.trim() === '')) {
      problems.push('physical claims \'measured\' but names no source for the unit or the measurement.');
    }
  }

  // --- 1 & 4. specs everywhere they appear --------------------------
  for (const spec of meta.website?.keySpecs ?? []) checkSpec(`website.keySpecs`, spec);
  for (const [key, part] of Object.entries(meta.parts ?? {})) {
    for (const spec of part.specs ?? []) checkSpec(`parts["${key}"].specs`, spec);
  }

  // --- 2. scenarios -------------------------------------------------
  for (const [i, scenario] of (meta.scenarios ?? []).entries()) {
    if (!Array.isArray(scenario.steps) || scenario.steps.length === 0) {
      problems.push(`scenarios[${i}] "${scenario.id}" has no steps.`);
      continue;
    }
    for (const [j, step] of scenario.steps.entries()) {
      if (!Number.isFinite(step.holdSec) || step.holdSec <= 0) {
        problems.push(`scenarios[${i}].steps[${j}] has holdSec ${step.holdSec}; the engine would advance instantly or never.`);
      }
      if (step.sectionId !== undefined && !sectionIds.has(step.sectionId)) {
        problems.push(`scenarios[${i}].steps[${j}] names section "${step.sectionId}", which this product does not have — the step would silently highlight nothing.`);
      }
      if (step.explode !== undefined && (step.explode < 0 || step.explode > 1)) {
        problems.push(`scenarios[${i}].steps[${j}] has explode ${step.explode}, outside 0..1.`);
      }
    }
  }

  return problems;
}

// -------------------------------------------------------------------

if (process.argv.includes('--self-test')) {
  // Four injected defects, one per check. If the checker cannot see
  // these, it cannot see the real thing either.
  const broken = {
    productId: 'selftest',
    productName: 'Self-test',
    physical: { spanM: 0, spanLabel: 'nose to tail', provenance: 'measured' },   // defects 3 and (measured, no note)
    parts: {
      'a#0': { displayName: 'A', description: 'a', specs: [{ label: 'Mass', value: '' }] },      // defect 4
    },
    sections: { 'section:one': { displayName: 'One', description: 'one', memberNodeKeys: ['a#0'] } },
    website: {
      tagline: 't',
      mtowKg: { min: 1, max: 2 },
      keySpecs: [{ label: 'Thrust', value: '40 N', provenance: 'measured' }],                    // defect 1
      flight: { ceilingM: 1, maxVelocityMs: 1, phases: [] },
    },
    scenarios: [{ id: 's', title: 'T', summary: 'x', steps: [{ caption: 'c', holdSec: 3, sectionId: 'section:nope' }] }], // defect 2
  };

  const found = checkFile('selftest', broken);
  const expectations = [
    ['spanM is zero', /physical\.spanM is 0/],
    ['physical measured with no note', /physical claims 'measured' but names no source/],
    ['spec measured with no note', /keySpecs: spec "Thrust" claims 'measured'/],
    ['spec with an empty value', /spec "Mass" has an empty value/],
    ['scenario naming a missing section', /names section "section:nope"/],
  ];

  console.log('='.repeat(78));
  console.log('SELF-TEST — five defects injected into a synthetic metadata file.\n');
  found.forEach((p) => console.log(`  reported: ${p}`));
  console.log('');

  let ok = true;
  for (const [what, pattern] of expectations) {
    const caught = found.some((p) => pattern.test(p));
    console.log(`  ${caught ? 'CAUGHT ' : 'MISSED '} ${what}`);
    if (!caught) ok = false;
  }
  console.log('');
  console.log('='.repeat(78));
  if (ok) {
    console.log('SELF-TEST PASSED — every injected defect was reported.');
    console.log('The checks can fail, so a clean run on the real files means something.');
    process.exit(0);
  }
  console.log('SELF-TEST FAILED — at least one injected defect went unreported.');
  process.exit(1);
}

if (!existsSync(METADATA_DIR)) {
  console.error(`No metadata directory at ${METADATA_DIR}`);
  process.exit(1);
}

let failed = false;
for (const file of readdirSync(METADATA_DIR).filter((f) => f.endsWith('.json'))) {
  const meta = JSON.parse(readFileSync(path.join(METADATA_DIR, file), 'utf8'));
  const problems = checkFile(file, meta);
  const specCount = (meta.website?.keySpecs?.length ?? 0)
    + Object.values(meta.parts ?? {}).reduce((n, p) => n + (p.specs?.length ?? 0), 0);
  const measured = [
    ...(meta.website?.keySpecs ?? []),
    ...Object.values(meta.parts ?? {}).flatMap((p) => p.specs ?? []),
  ].filter((s) => s.provenance === 'measured').length;

  console.log(
    `${file.padEnd(16)} v${meta.schemaVersion ?? '?'}  ` +
    `span=${meta.physical ? `${meta.physical.spanM}m (${meta.physical.provenance ?? 'placeholder'})`.padEnd(22) : '—'.padEnd(22)} ` +
    `specs=${String(specCount).padStart(3)} measured=${String(measured).padStart(3)}  ` +
    (problems.length === 0 ? 'OK' : `${problems.length} PROBLEM(S)`),
  );
  for (const p of problems) {
    console.log(`    - ${p}`);
    failed = true;
  }
}

console.log('');
console.log(failed ? 'FAIL' : 'PASS: every metadata file satisfies the schema v5 rules.');
process.exit(failed ? 1 : 0);

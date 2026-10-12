// path: cad-pipeline/verify_turntable_upright.js
//
// PURPOSE (2026-09-07, second rotation pass): prove that no amount of
// dragging can turn the aircraft upside down or roll it, while still
// letting the view reach the top and the bottom.
//
// THE REPORT THIS ANSWERS. The first rotation pass replaced OrbitControls'
// turntable with a free screen-space arcball on the model. That fixed the
// sensitivity and the pole snap, and introduced a worse problem: an
// arcball has no up-vector, so a long drag rolled the drone over. The
// owner: "the camera should orbit around the drone, but the drone itself
// should remain properly upright ... I should not be able to roll the
// drone upside down."
//
// WHY THIS IS AN A/B AND NOT A ONE-SIDED CHECK. Asserting "the shipped
// rotation never inverts the model" on its own proves nothing, because a
// check that measured the wrong quantity would also never fire. So the
// PREVIOUS implementation is run through the identical drag sequence and
// is REQUIRED to invert. Only then does the shipped one's clean sheet mean
// something. Standing rule, docs/MEMORY.md section 5.
//
// WHAT IS MEASURED: the model's own up axis, expressed in CAMERA space.
//   y  = how far up the screen it points. y <= 0 is the aircraft inverted.
//   x  = its sideways component. Non-zero x IS roll, the horizon tilting.
// Both are properties of what a person at the kiosk sees, which is what
// the report was about. Measuring the camera's spherical angles instead
// would beg the question: the arcball has no spherical angles to measure.
//
// Runs on generated data, no CAD files and no app source.
//
//   node cad-pipeline/verify_turntable_upright.js

const THREE = require('three');

/** Viewport height in CSS pixels, the divisor both models normalise by. */
const H = 900;
const DEG = 180 / Math.PI;

/** Mirrors src/components/Viewer.tsx. */
const ROTATE_RADIANS_PER_VIEWPORT = Math.PI;
const MIN_POLAR_DEG = 1;
const MAX_POLAR_DEG = 179;

const MODEL_UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------
// A: THE SHIPPED TURNTABLE. The model is never rotated; the camera orbits
// it with a free azimuth and a clamped polar angle, keeping world up.
// ---------------------------------------------------------------------
function makeTurntable() {
  const spherical = new THREE.Spherical(10, Math.PI / 2.4, 0);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
  const target = new THREE.Vector3(0, 0, 0);
  const gain = ROTATE_RADIANS_PER_VIEWPORT / H;

  return {
    name: 'turntable (shipped)',
    drag(dx, dy) {
      spherical.theta -= dx * gain;
      spherical.phi -= dy * gain;
      spherical.phi = THREE.MathUtils.clamp(
        spherical.phi,
        THREE.MathUtils.degToRad(MIN_POLAR_DEG),
        THREE.MathUtils.degToRad(MAX_POLAR_DEG),
      );
    },
    /** The model's up axis in camera space. The model carries no rotation
     * of its own, so this is world up seen from wherever the camera is. */
    modelUpInView() {
      camera.position.setFromSpherical(spherical).add(target);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.updateMatrixWorld(true);
      return MODEL_UP.clone().applyQuaternion(camera.quaternion.clone().invert());
    },
    elevationDeg() { return 90 - spherical.phi * DEG; },
  };
}

// ---------------------------------------------------------------------
// B: THE PREVIOUS FREE ARCBALL, kept only so it can fail. The camera is
// fixed and the MODEL accumulates an unconstrained quaternion.
// ---------------------------------------------------------------------
function makeArcball() {
  const q = new THREE.Quaternion();
  const right = new THREE.Vector3(1, 0, 0);
  const up = new THREE.Vector3(0, 1, 0);
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  const gain = ROTATE_RADIANS_PER_VIEWPORT / H;

  return {
    name: 'free arcball (previous)',
    drag(dx, dy) {
      const axis = new THREE.Vector3()
        .addScaledVector(right, dy)
        .addScaledVector(up, dx);
      if (axis.lengthSq() < 1e-12) return;
      const angle = Math.hypot(dx, dy) * gain;
      q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis.normalize(), angle));
    },
    modelUpInView() {
      // The model IS rotated here, so its up axis moves.
      return MODEL_UP.clone()
        .applyQuaternion(q)
        .applyQuaternion(camera.quaternion.clone().invert());
    },
    elevationDeg() { return NaN; },
  };
}

// ---------------------------------------------------------------------

/**
 * "If I keep dragging the mouse" -- the owner's own words, and the drag
 * pattern matters more than it looks.
 *
 * A SINGLE STRAIGHT DRAG CANNOT INVERT AN ARCBALL, however long. Every
 * step rotates about the same axis, so the model's up vector just traces a
 * cone around it: dragging 120x90 forever bottoms out at y = 0.28 and
 * never goes below. That is why the first version of this check passed the
 * broken implementation, and it is worth stating because it is also why
 * the bug survived a first pass of manual testing.
 *
 * ROLL ACCUMULATES FROM CHANGES OF DIRECTION. Composing rotations about
 * different axes leaves a residue that is not a rotation about either of
 * them -- the same geometric phase that makes a hand-held arcball drift --
 * and it is unbounded. So this walks a deterministic pseudo-random set of
 * drag directions, which is what a hand actually does.
 */
function sweep(model, steps = 60) {
  // A tiny LCG rather than Math.random: this has to fail identically on
  // every machine, or "the injected bug went undetected" becomes a
  // coin toss.
  let seed = 20260907;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let worstUpY = Infinity;
  let worstRoll = 0;
  let inverted = 0;
  for (let i = 0; i < steps; i++) {
    const angle = rand() * Math.PI * 2;
    const length = 120 + rand() * 200;
    model.drag(Math.cos(angle) * length, Math.sin(angle) * length);
    const up = model.modelUpInView();
    worstUpY = Math.min(worstUpY, up.y);
    worstRoll = Math.max(worstRoll, Math.abs(up.x));
    if (up.y <= 0) inverted++;
  }
  return { worstUpY, worstRoll, inverted, steps };
}

function check(label, ok, detail) {
  console.log(`       ${ok ? '✓' : '✗'} ${label}`);
  if (detail) console.log(`         ${detail}`);
  return ok ? 0 : 1;
}

function main() {
  let failures = 0;
  console.log('UPRIGHTNESS A/B -- can dragging turn the aircraft over?');
  console.log(`(viewport height ${H}px; 60 drags of 120-320px in varied directions)`);
  console.log('');

  // -- 1. The injected failure -----------------------------------------
  const arc = sweep(makeArcball());
  console.log('  1. free arcball (previous)');
  console.log(`       lowest the model's up axis pointed .. y = ${arc.worstUpY.toFixed(3)}`);
  console.log(`       worst roll (sideways up-component) .. x = ${arc.worstRoll.toFixed(3)}`);
  console.log(`       frames with the aircraft INVERTED ... ${arc.inverted} of ${arc.steps}`);
  failures += check(
    'the previous rotation really does turn the aircraft upside down',
    arc.inverted > 0 && arc.worstUpY < 0,
    'This is the injected failure. If it did not invert, the check below could '
    + 'not fail either and would prove nothing.',
  );
  console.log('');

  // -- 2. The shipped turntable ----------------------------------------
  const tt = sweep(makeTurntable());
  console.log('  2. turntable (shipped)');
  console.log(`       lowest the model's up axis pointed .. y = ${tt.worstUpY.toFixed(4)}`);
  console.log(`       worst roll (sideways up-component) .. x = ${tt.worstRoll.toExponential(2)}`);
  console.log(`       frames with the aircraft INVERTED ... ${tt.inverted} of ${tt.steps}`);
  failures += check(
    'the aircraft is never inverted',
    tt.inverted === 0 && tt.worstUpY > 0,
    `its up axis never fell below y = ${tt.worstUpY.toFixed(4)}, which is the `
    + `${MIN_POLAR_DEG} degree clearance the polar clamp keeps from the pole.`,
  );
  failures += check(
    'the horizon never tilts -- roll is not merely small, it is absent',
    tt.worstRoll < 1e-9,
    'the model up axis projects onto the screen vertical exactly, because the '
    + 'camera keeps world up and the model carries no rotation at all.',
  );
  console.log('');

  // -- 3. Top and bottom must still be reachable ------------------------
  console.log('  3. Can you still see the top and the bottom?');
  for (const [label, dy] of [['drag DOWN (toward the top view)', -400], ['drag UP (toward the bottom view)', 400]]) {
    const m = makeTurntable();
    let inverted = 0;
    for (let i = 0; i < 12; i++) {
      m.drag(0, dy);
      if (m.modelUpInView().y <= 0) inverted++;
    }
    const elev = m.elevationDeg();
    console.log(`       ${label}: ended at ${elev.toFixed(1)} deg elevation, ${inverted} inverted frames`);
    failures += check(
      `reaches ${dy < 0 ? 'the top' : 'the bottom'} view without going over`,
      Math.abs(Math.abs(elev) - 89) < 0.01 && inverted === 0,
      `89 degrees is straight ${dy < 0 ? 'down onto the aircraft' : 'up at its underside'}, `
      + 'one degree short of the pole -- far enough to see everything, not far enough to flip.',
    );
  }
  console.log('');

  // -- 4. Azimuth stays free, and the gain is unchanged ------------------
  console.log('  4. Sensitivity and azimuth');
  const spin = makeTurntable();
  const startElev = spin.elevationDeg();
  for (let i = 0; i < 12; i++) spin.drag(150, 0);
  const elevAfterSpin = spin.elevationDeg();
  console.log('       12 x 150px horizontal: elevation unchanged at '
    + `${elevAfterSpin.toFixed(1)} deg -- azimuth is unclamped and wraps freely`);
  failures += check(
    'a horizontal drag never changes elevation, however far it goes',
    Math.abs(elevAfterSpin - startElev) < 1e-9,
    'the two axes are independent, so spinning the aircraft round cannot '
    + 'creep it toward a pole.',
  );

  const vert = makeTurntable();
  const e0 = vert.elevationDeg();
  vert.drag(0, -H / 2);
  const delta = vert.elevationDeg() - e0;
  console.log(`       a half-viewport vertical drag changes elevation by ${delta.toFixed(1)} deg`);
  failures += check(
    'the gain from the first pass is kept: pi per viewport height',
    Math.abs(Math.abs(delta) - 90) < 0.01,
    'half a viewport is 90 degrees, so a full one is 180 -- half of '
    + "OrbitControls' 2*pi, which was the \"too sensitive\" half of the first report.",
  );
  console.log('');

  if (failures === 0) {
    console.log('PASS: dragging cannot invert or roll the aircraft, and the top and');
    console.log('      bottom views are both still reachable.');
    process.exit(0);
  }
  console.log(`FAIL: ${failures} check(s) above.`);
  process.exit(1);
}

main();

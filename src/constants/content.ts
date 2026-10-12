import type { KioskSettings } from '../lib/settings';

export const IMAGES = {
  hero: '/images/propulsion.jpg',
  cockpit: '/images/cockpit.jpg',
  expos: '/images/engineering.jpg',
  website: '/images/propeller.jpg',
  motor: '/images/motor.jpg',
  integrated: '/images/integrated.jpg',
};

export const BRAND = {
  name: 'Nautical Wings',
  full: 'Nautical Wings Aerospace',
  product: 'Digital Product Experience',
  short: 'NWA DPE',
};

export const ENTRY = {
  pill: 'Nautical Wings Aerospace',
  titleLead: 'Digital Product',
  titleAccent: 'Experience',
  body: 'One engine, two ways in. Explore an airframe part by part, or find the aircraft that matches your payload and fly its performance envelope.',
  heroLabel: 'AXOM Series · Live 3D',
  doorsPill: 'Two ways in',
  doorsTitle: 'Choose your experience',
  doors: {
    expos: {
      kicker: 'On the stand',
      title: 'Expos',
      body: 'The full interactive teardown, built for a touch display. Select any section of an airframe, isolate it, separate its components and drive the propulsion system live.',
      points: ['Section-first selection', 'Exploded views', 'RPM and blade-pitch control'],
      cta: 'Open the kiosk',
    },
    website: {
      kicker: 'For customers',
      title: 'Website',
      body: 'The AXOM range as a customer meets it. Enter your maximum take-off weight to see which airframe fits, then take it up and watch its thrust, drag and altitude through the climb.',
      points: ['MTOW-matched recommendation', 'Rotating product showcase', 'Flyable performance envelope'],
      cta: 'Enter the showcase',
    },
  },
};

export const MENU = {
  pill: 'Select product',
  title: 'Product Catalog',
  body: 'Explore NWA products in 3D. Select an assembly to rotate, isolate a section, separate its components, and drive the propulsion system.',
  rangePill: 'Across the range',
  rangeTitle: 'Compare and curate',
  actions: {
    fleet: { label: 'Fleet', title: 'Fleet line-up', desc: 'Every aircraft to scale, side by side, each one independently orbitable.', cta: 'View line-up', icon: '⬡' },
    specs: { label: 'Matrix', title: 'Specification matrix', desc: 'The whole catalogue in one table — counted structure and published figures.', cta: 'Open matrix', icon: '◈' },
    compare: { label: 'Compare', title: 'Compare two aircraft', desc: 'Two airframes in 3D at true relative scale with a row-by-row diff.', cta: 'Start comparing', icon: '◉' },
    admin: { label: 'Content', title: 'Kiosk content', desc: 'Correct names and descriptions on this machine without a rebuild.', cta: 'Edit copy', icon: '◧' },
  },
};

export const SHOWCASE_COPY = {
  pill: 'AXOM Series',
  title: 'Build your system',
  body: 'Tell us what the aircraft has to lift. We will show you which AXOM airframe carries it — then you can take that airframe up and fly its envelope.',
  mtowLabel: 'Maximum take-off weight',
  mtowPlaceholder: 'e.g. 4.5',
  disclaimer: 'Unbadged figures are illustrative placeholders for this stand-in model, not published specifications.',
};

export const GATE_COPY = {
  visualLabel: 'Altitude limit',
  visualTitleLead: 'Sign in to keep',
  visualTitleAccent: 'climbing',
  visualBody: 'is part of the full performance envelope. Sign in to release the ceiling for this session.',
  formLabel: 'NW Platform',
  formTitleLead: 'Unlock the full',
  formTitleAccent: 'flight envelope',
  demoNotice: 'Demonstration only — no account is created and nothing is sent anywhere. Any valid-looking email with an eight-character password will do.',
  emailPlaceholder: 'you@email.com',
  passwordPlaceholder: 'Min. 8 characters',
};

export const CRUMB_LABELS = {
  root: BRAND.short,
  expos: 'Expos',
  website: 'Website',
  detail: 'Detailed View',
  rpm: 'RPM Control',
  fleet: 'Fleet line-up',
  specs: 'Spec matrix',
  compare: 'Compare',
  admin: 'Kiosk content',
};

export const SETTINGS_ROWS: { key: keyof Pick<KioskSettings, 'reducedMotion' | 'colorblindSafe' | 'sound' | 'studio' | 'explodeLabels' | 'idleDemo'>; label: string; help: string }[] = [
  {
    key: 'reducedMotion',
    label: 'Reduced motion',
    help: 'Stops the showcase turntables, the guided-tour camera orbit and the ambient propeller spin. Continuous motion is the main trigger for vestibular discomfort, and it is also what makes a screen unreadable to some visitors.',
  },
  {
    key: 'colorblindSafe',
    label: 'High-contrast selection colour',
    help: 'Switches the selection highlight from blue to orange. The default blue separates from the grey CAD geometry mainly by hue; the orange also separates by brightness, so it stays visible with red-green colour blindness.',
  },
  {
    key: 'sound',
    label: 'Interface sounds',
    help: 'Short synthesised tones on selection and navigation. Generated in the browser — no audio files are downloaded. Off by default because a show floor is already loud.',
  },
  {
    key: 'studio',
    label: 'Studio backdrop',
    help: 'Puts the 3D viewport on a dark studio ground with the lighting re-balanced for it, instead of the light ground. Also on the STUDIO button in the viewport; it is repeated here because this is where a setting that persists across restarts belongs.',
  },
  {
    key: 'explodeLabels',
    label: 'Part names in exploded views',
    help: 'Floating labels beside each named component while a view is separated, with a leader line to the part they belong to. Only authored components are named. Suppressed automatically when more than 30 would appear at once.',
  },
  {
    key: 'idleDemo',
    label: 'Guided tour when idle',
    help: 'After a period with nobody touching the screen, the viewer walks itself through every section of the current product. Any touch hands control straight back.',
  },
];

export const WHY_NOTES = {
  sectionSuffix: 'Section membership is authored data, generated offline from geometry and reviewed — the viewer does a pure lookup and applies no heuristics.',
  rigIntro: 'This component authors a rig: its hub and its rotating geometry are separate solids in the CAD, verified offline, so the two can be driven independently.',
  rigFused: ' Its blades are fused into one solid, so blade pitch is geometrically impossible here and is deliberately not faked — rotating a fused pair about its span produces a see-saw, not a pitch.',
  pitchAssembly: 'Fuselage propeller — the lift propellers are single-piece in this CAD.',
  pitchRpm: 'Hub travels along the shaft as the blades twist.',
  noMetadataPart: 'No authored metadata for this part yet — showing the raw GLB node name.',
  noMetadataComponent: 'No authored metadata for this component yet — showing the raw GLB node name.',
  noMetadataSolid: 'No authored metadata for this solid yet — showing the raw GLB node name.',
};

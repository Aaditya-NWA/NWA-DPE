export const STORAGE_KEYS = {
  settings: 'nwa.dpe.kiosk-settings.v2',
  overrides: 'nwa.dpe.content-overrides',
  session: 'nwa.dpe.mock-session',
};

export const AUTH = {
  minPasswordLength: 8,
  fakeLatencyMs: 450,
  emailPattern: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
};

export const SETTINGS_LIMITS = {
  idleDelayMin: 15,
  idleDelayMax: 180,
  idleDelayStep: 5,
  idleDelayFloor: 10,
};

export const DEFAULT_SETTINGS = {
  colorblindSafe: false,
  sound: false,
  idleDemo: true,
  idleDemoDelaySec: 45,
  explodeLabels: true,
  scaleReferenceOpen: true,
  studio: true,
};

export const TICK_MS = 50;

export const IDLE_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

export const GAMEPAD_BUTTONS = {
  confirm: 0,
  back: 1,
  toggle: 2,
  demo: 3,
  prev: 4,
  next: 5,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export const GAMEPAD_DIAL_AXIS = 3;
export const GAMEPAD_DEAD_ZONE = 0.18;

export const AUDIO_ATTACK_SEC = 0.012;
export const AUDIO_FLOOR_GAIN = 0.0001;

export const CAPTURE = {
  captionHeight: 86,
  probeSize: 32,
  slugMaxLength: 60,
  brand: 'NAUTICAL WINGS AEROSPACE — DIGITAL PRODUCT EXPERIENCE',
  fallbackBackground: '#FFFFFF',
  stripBackground: '#0a1628',
  stripAccent: '#59a2b8',
  title: '#f5f5f5',
  body: '#b8c9d4',
  meta: '#7584b3',
  font: '"Inter Variable", "Inter", "Segoe UI", system-ui, sans-serif',
  monoFont: 'ui-monospace, "Cascadia Mono", monospace',
};

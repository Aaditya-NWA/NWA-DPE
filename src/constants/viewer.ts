export const CAMERA = {
  inspectionPosition: [3, 2, 4] as [number, number, number],
  inspectionFov: 45,
  showcasePosition: [2.6, 1.5, 4.4] as [number, number, number],
  showcaseFov: 42,
  boundsMargin: 1.2,
  showcaseMargin: 1.35,
  autoRotateSpeed: 0.9,
};

export const TURNTABLE = {
  radiansPerViewport: Math.PI,
  smoothing: 22,
  minPolarDeg: 1,
  maxPolarDeg: 179,
  convergeEpsilon: 1e-4,
  initialPolar: Math.PI / 3,
};

export const WATCHDOG = {
  hangTimeoutMs: 4000,
  pollMs: 1000,
};

export const EXPLODE = {
  radialScale: 0.6,
  axialScale: 0.5,
  tweenSeconds: 0.9,
  spinStopThreshold: 0.02,
  toggleThreshold: 0.5,
};

export const LABELS = {
  explodeThreshold: 0.18,
  limit: 30,
  leaderPx: 104,
  rowPx: 27,
  offscreenMarginPx: 40,
  fallbackChipWidth: 120,
  defaultInset: { top: 84, right: 16, bottom: 84, left: 16 },
  inset: { top: 96, bottom: 100, edge: 16, telemetry: 340, info: 360 },
};

export const XRAY = {
  fadeFactor: 0.94,
};

export const HIGHLIGHT_INTENSITY = 0.6;

export const RPM = {
  max: 300,
  assemblyDefault: 120,
};

export const PITCH_DEFAULT_MAX_DEG = 30;

export const SHOWCASE = {
  turntableSpeed: 1.6,
  rotorRpm: 90,
  compareTurntable: 1.2,
  compareMargin: 1.45,
  fleetTurntable: 1.1,
  fleetMargin: 1.1,
  spinRpm: 100,
  flightMargin: 1.5,
};

export const PERF_SAMPLE_MS = 500;

export const HUMAN_HEIGHT_M = 1.75;

export const TOUR_NEAR_PROGRESS = 0.7;


export const LIGHT_RIGS = {
  light: {
    hemisphere: ['#ffffff', '#9fb0bb', 0.85] as [string, string, number],
    key: 1.35,
    fill: 0.38,
    rim: 0.55,
  },
  studio: {
    hemisphere: ['#c9d8e4', '#0E1216', 0.5] as [string, string, number],
    key: 1.7,
    fill: 0.22,
    rim: 0.95,
  },
};

export const LIGHT_POSITIONS = {
  key: [4, 6, 5] as [number, number, number],
  fill: [-4, -2, -3] as [number, number, number],
  rim: [-2, 4, -6] as [number, number, number],
};

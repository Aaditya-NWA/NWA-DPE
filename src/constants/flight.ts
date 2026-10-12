import type { PilotInput } from '../lib/flight';

export const GATE_ALTITUDE_M = 3000;
export const GATE_REARM_MARGIN_M = 150;

export const FLIGHT_TIMING = {
  climbSeconds: 16,
  accelSeconds: 12,
  brakeSeconds: 5,
  maxFrameDt: 0.05,
};

export const MAX_DISC_TILT_DEG = 25;

export const ROTOR_RPM = { base: 120, span: 240 };

export const PLOT = {
  insetPct: 7,
  trailMinStep: 0.5,
  trailMaxPoints: 400,
  targetTicks: 5,
  tickSteps: [1, 2, 2.5, 5, 10],
  aircraftSizePx: 200,
};

export const KEY_BINDINGS: Record<string, keyof PilotInput> = {
  ArrowUp: 'climb',
  ArrowDown: 'descend',
  ArrowRight: 'accelerate',
  ArrowLeft: 'brake',
};

export const IDLE_INPUT: PilotInput = { climb: false, descend: false, accelerate: false, brake: false };

type Rgb = [number, number, number];

export const SKY_PALETTE = {
  top: [[0, [18, 44, 70]], [0.5, [9, 26, 46]], [1, [3, 9, 22]]] as [number, Rgb][],
  bottom: [[0, [44, 86, 104]], [0.35, [22, 52, 74]], [1, [10, 24, 44]]] as [number, Rgb][],
  farMountains: '#10283d',
  snowCaps: 'rgba(126, 200, 216, 0.32)',
  hills: '#0d2b33',
  groundFar: '#0c2622',
  groundNear: '#0a1f1c',
  trees: '#0f3a33',
  cloud: 'rgba(184, 201, 212, 0.16)',
  cirrus: 'rgba(126, 200, 216, 0.22)',
  star: '#dbe9f0',
  scrim: 'rgba(2, 8, 20, 0.22)',
};

export const SKY_STARS: [number, number, number][] = [
  [8, 12, 2], [17, 30, 1.5], [26, 8, 2], [34, 22, 1.5], [43, 14, 2], [52, 5, 1.5],
  [61, 26, 2], [70, 10, 1.5], [78, 19, 2], [87, 7, 1.5], [93, 28, 2], [13, 40, 1.5],
  [39, 36, 1.5], [66, 38, 1.5], [84, 34, 1.5], [4, 24, 1.5], [57, 17, 1.5], [48, 30, 2],
];

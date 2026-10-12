import { FLIGHT_TIMING, MAX_DISC_TILT_DEG, PLOT, ROTOR_RPM } from '../constants/flight';
import type { FlightEnvelope } from '../types/product';

// Two independent axes flown over an authored envelope. Not a simulation.
export interface FlightVector {
  altitudeM: number;
  velocityMs: number;
}

export interface PilotInput {
  climb: boolean;
  descend: boolean;
  accelerate: boolean;
  brake: boolean;
}

// Both axes hold when nothing is pressed; altitudeCapM is the sign-in gate.
export function step(
  current: FlightVector,
  input: PilotInput,
  envelope: FlightEnvelope,
  altitudeCapM: number,
  dt: number,
): { next: FlightVector; blockedByCap: boolean } {
  const climbRate = envelope.ceilingM / FLIGHT_TIMING.climbSeconds;
  const accel = envelope.maxVelocityMs / FLIGHT_TIMING.accelSeconds;
  const brake = envelope.maxVelocityMs / FLIGHT_TIMING.brakeSeconds;

  let altitude = current.altitudeM;
  if (input.climb) altitude += climbRate * dt;
  if (input.descend) altitude -= climbRate * dt;

  const blockedByCap = input.climb && altitude > altitudeCapM;
  altitude = Math.max(0, Math.min(altitudeCapM, altitude));

  let velocity = current.velocityMs;
  if (input.accelerate) velocity += accel * dt;
  else if (input.brake) velocity -= brake * dt;
  velocity = Math.max(0, Math.min(envelope.maxVelocityMs, velocity));

  return { next: { altitudeM: altitude, velocityMs: velocity }, blockedByCap };
}

export function thrustAtAltitude(envelope: FlightEnvelope, altitudeM: number): number {
  const { phases } = envelope;
  for (let i = 0; i < phases.length - 1; i++) {
    const lo = phases[i];
    const hi = phases[i + 1];
    if (altitudeM <= hi.altitudeM) {
      const span = hi.altitudeM - lo.altitudeM;
      const k = span > 0 ? (altitudeM - lo.altitudeM) / span : 0;
      return lo.thrustN + (hi.thrustN - lo.thrustN) * k;
    }
  }
  return phases[phases.length - 1].thrustN;
}

export function phaseLabelAtAltitude(envelope: FlightEnvelope, altitudeM: number): string {
  let label = envelope.phases[0].label;
  for (const p of envelope.phases) {
    if (altitudeM >= p.altitudeM) label = p.label;
  }
  return label;
}

// Quadratic in airspeed, anchored on the authored cruise point.
export function dragAtVelocity(envelope: FlightEnvelope, velocityMs: number): number {
  const anchor = envelope.phases.find((p) => p.label === 'CRUISE' && p.velocityMs > 0)
    ?? envelope.phases.find((p) => p.velocityMs > 0);
  if (!anchor) return 0;
  const ratio = velocityMs / anchor.velocityMs;
  return anchor.dragN * ratio * ratio;
}

// A multirotor leans its whole airframe into the wind; it has no variable pitch.
export function discTiltDeg(velocityMs: number, maxVelocityMs: number): number {
  if (maxVelocityMs <= 0) return 0;
  return Math.min(MAX_DISC_TILT_DEG, (velocityMs / maxVelocityMs) * MAX_DISC_TILT_DEG);
}

export function rotorRpm(thrustN: number, envelope: FlightEnvelope): number {
  const peak = Math.max(...envelope.phases.map((p) => p.thrustN)) || 1;
  return Math.round(ROTOR_RPM.base + (thrustN / peak) * ROTOR_RPM.span);
}

export function tickValues(max: number): number[] {
  const raw = max / PLOT.targetTicks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const stepSize = PLOT.tickSteps.map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-6; v += stepSize) out.push(Math.round(v * 100) / 100);
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}

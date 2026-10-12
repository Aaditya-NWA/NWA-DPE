import { AUDIO_ATTACK_SEC, AUDIO_FLOOR_GAIN } from '../constants/system';
import { getSettings } from './settings';

export type Cue = 'tap' | 'enter' | 'back' | 'select' | 'deny';

interface Tone {
  freq: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  delay?: number;
}

const CUES: Record<Cue, Tone[]> = {
  tap: [{ freq: 660, duration: 0.06, type: 'sine', gain: 0.05 }],
  enter: [
    { freq: 523.25, duration: 0.09, type: 'sine', gain: 0.06 },
    { freq: 659.25, duration: 0.13, type: 'sine', gain: 0.06, delay: 0.07 },
  ],
  back: [
    { freq: 659.25, duration: 0.09, type: 'sine', gain: 0.055 },
    { freq: 523.25, duration: 0.13, type: 'sine', gain: 0.055, delay: 0.07 },
  ],
  select: [{ freq: 880, duration: 0.07, type: 'triangle', gain: 0.045 }],
  deny: [{ freq: 196, duration: 0.16, type: 'sawtooth', gain: 0.035 }],
};

let ctx: AudioContext | null = null;

// Created lazily inside the first user gesture to satisfy autoplay policy.
function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch (err) {
      console.warn('[audio] could not create an AudioContext; sound disabled', err);
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone({ freq, duration, type, gain: peak, delay = 0 }: Tone) {
  const ac = context();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(AUDIO_FLOOR_GAIN, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + AUDIO_ATTACK_SEC);
  gain.gain.exponentialRampToValueAtTime(AUDIO_FLOOR_GAIN, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export function play(cue: Cue): void {
  if (!getSettings().sound) return;
  CUES[cue].forEach(tone);
}

export function shutdown(): void {
  if (!ctx) return;
  void ctx.close().catch(() => { /* already closed */ });
  ctx = null;
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { IDLE_EVENTS, TICK_MS } from '../constants/system';
import { smoothstep } from './tween';
import type { Scenario, ScenarioStep, SectionMetadata } from '../types/product';

export function buildDefaultScenario(
  productName: string,
  sections: Record<string, SectionMetadata>,
  options: { canExplode: boolean },
): Scenario | null {
  const entries = Object.entries(sections);
  if (entries.length === 0) return null;

  const ordered = entries.slice().sort((a, b) => b[1].memberNodeKeys.length - a[1].memberNodeKeys.length);

  const steps: ScenarioStep[] = [
    {
      caption: `${productName} — complete assembly. Touch the screen at any time to take over.`,
      holdSec: 5,
      spin: true,
      autoOrbit: true,
      explode: 0,
    },
    ...ordered.map<ScenarioStep>(([sectionId, section]) => ({
      caption: `${section.displayName} — ${section.memberNodeKeys.length} solids.`,
      holdSec: 4.5,
      sectionId,
      autoOrbit: true,
    })),
  ];

  // Rotors stop for the separation and restart once reassembled; the explicit
  // spin flags matter because sticky fields resolve backwards.
  if (options.canExplode) {
    steps.push(
      { caption: 'Separated view — every solid displaced from the assembly centre.', holdSec: 6, explode: 0.85, spin: false, autoOrbit: true },
      { caption: 'Back together.', holdSec: 6, explode: 0, spin: false, autoOrbit: true },
      { caption: `${productName} — reassembled, rotors turning.`, holdSec: 4, explode: 0, spin: true, autoOrbit: true },
    );
  }

  return {
    id: 'generated-tour',
    title: 'Guided tour',
    summary: `Every section of the ${productName}, in order of size.`,
    steps,
  };
}

export interface PlaybackState {
  active: boolean;
  stepIndex: number;
  caption: string;
  sectionId: string | null;
  explode: number;
  spin: boolean;
  autoOrbit: boolean;
  progress: number;
  stepCount: number;
}

const IDLE_STATE: PlaybackState = {
  active: false,
  stepIndex: 0,
  caption: '',
  sectionId: null,
  explode: 0,
  spin: false,
  autoOrbit: false,
  progress: 0,
  stepCount: 0,
};

export interface PlaybackControls {
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
}

function resolveStickyFields(steps: ScenarioStep[], index: number) {
  let sectionId: string | null = null;
  let spin = false;
  let autoOrbit = false;
  let sawSection = false;
  let sawSpin = false;
  let sawOrbit = false;
  for (let j = index; j >= 0; j--) {
    const s = steps[j];
    if (!sawSection && 'sectionId' in s) { sectionId = s.sectionId ?? null; sawSection = true; }
    if (!sawSpin && s.spin !== undefined) { spin = s.spin; sawSpin = true; }
    if (!sawOrbit && s.autoOrbit !== undefined) { autoOrbit = s.autoOrbit; sawOrbit = true; }
    if (sawSection && sawSpin && sawOrbit) break;
  }
  return { sectionId, spin, autoOrbit };
}

export function useScenarioPlayback(scenario: Scenario | null): [PlaybackState, PlaybackControls] {
  const [state, setState] = useState<PlaybackState>(IDLE_STATE);
  const stepIndexRef = useRef(0);
  const stepStartRef = useRef(0);
  const runningRef = useRef(false);
  const explodeFromRef = useRef(0);
  const explodeNowRef = useRef(0);

  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;

  const publish = useCallback((now: number) => {
    const sc = scenarioRef.current;
    if (!sc || sc.steps.length === 0) return;
    const i = Math.min(stepIndexRef.current, sc.steps.length - 1);
    const step = sc.steps[i];
    const elapsed = (now - stepStartRef.current) / 1000;
    const progress = step.holdSec > 0 ? Math.min(1, elapsed / step.holdSec) : 1;

    const explodeTarget = step.explode;
    const explode = explodeTarget === undefined
      ? explodeFromRef.current
      : explodeFromRef.current + (explodeTarget - explodeFromRef.current) * smoothstep(progress);
    explodeNowRef.current = explode;

    setState({
      active: true,
      stepIndex: i,
      caption: step.caption,
      ...resolveStickyFields(sc.steps, i),
      explode,
      progress,
      stepCount: sc.steps.length,
    });

    if (progress >= 1) {
      explodeFromRef.current = explodeTarget ?? explodeFromRef.current;
      stepIndexRef.current = (i + 1) % sc.steps.length;
      stepStartRef.current = now;
    }
  }, []);

  useEffect(() => {
    if (!state.active) return;
    const id = window.setInterval(() => {
      if (!runningRef.current) return;
      publish(performance.now());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state.active, publish]);

  const start = useCallback(() => {
    const sc = scenarioRef.current;
    if (!sc || sc.steps.length === 0) return;
    stepIndexRef.current = 0;
    stepStartRef.current = performance.now();
    explodeFromRef.current = 0;
    explodeNowRef.current = 0;
    runningRef.current = true;
    publish(performance.now());
  }, [publish]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setState(IDLE_STATE);
  }, []);

  const jump = useCallback((delta: number) => {
    const sc = scenarioRef.current;
    if (!sc || sc.steps.length === 0) return;
    const count = sc.steps.length;
    stepIndexRef.current = (stepIndexRef.current + delta + count) % count;
    stepStartRef.current = performance.now();
    explodeFromRef.current = explodeNowRef.current;
    publish(performance.now());
  }, [publish]);

  const next = useCallback(() => jump(1), [jump]);
  const prev = useCallback(() => jump(-1), [jump]);

  return [state, { start, stop, next, prev }];
}

// Capture phase: the canvas stops propagation of its own pointer events.
export function useIdleTimer(enabled: boolean, delaySec: number, onIdle: () => void): void {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onIdleRef.current(), delaySec * 1000);
    };
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, reset, { capture: true, passive: true }));
    reset();
    return () => {
      window.clearTimeout(timer);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, reset, { capture: true }));
    };
  }, [enabled, delaySec]);
}

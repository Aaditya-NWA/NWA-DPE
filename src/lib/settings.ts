import { useCallback, useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, SETTINGS_LIMITS, STORAGE_KEYS } from '../constants/system';

export interface KioskSettings {
  reducedMotion: boolean;
  colorblindSafe: boolean;
  sound: boolean;
  idleDemo: boolean;
  idleDemoDelaySec: number;
  explodeLabels: boolean;
  scaleReferenceOpen: boolean;
  studio: boolean;
}

function systemPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function defaults(): KioskSettings {
  return { reducedMotion: systemPrefersReducedMotion(), ...DEFAULT_SETTINGS };
}

const pickBool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

function load(): KioskSettings {
  const base = defaults();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<KioskSettings>;
    const delay = parsed.idleDemoDelaySec;
    return {
      reducedMotion: pickBool(parsed.reducedMotion, base.reducedMotion),
      colorblindSafe: pickBool(parsed.colorblindSafe, base.colorblindSafe),
      sound: pickBool(parsed.sound, base.sound),
      idleDemo: pickBool(parsed.idleDemo, base.idleDemo),
      idleDemoDelaySec: Number.isFinite(delay) && delay! >= SETTINGS_LIMITS.idleDelayFloor ? delay! : base.idleDemoDelaySec,
      explodeLabels: pickBool(parsed.explodeLabels, base.explodeLabels),
      scaleReferenceOpen: pickBool(parsed.scaleReferenceOpen, base.scaleReferenceOpen),
      studio: pickBool(parsed.studio, base.studio),
    };
  } catch (err) {
    console.warn('[settings] could not read stored settings; using defaults', err);
    return base;
  }
}

let current: KioskSettings = load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getSettings(): KioskSettings {
  return current;
}

export function setSettings(patch: Partial<KioskSettings>): void {
  const next = { ...current, ...patch };
  const changed = (Object.keys(next) as (keyof KioskSettings)[]).some((k) => next[k] !== current[k]);
  if (!changed) return;
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(current));
  } catch (err) {
    console.warn('[settings] could not persist settings', err);
  }
  emit();
}

export function resetSettings(): void {
  current = defaults();
  try {
    window.localStorage.removeItem(STORAGE_KEYS.settings);
  } catch { /* private mode: in-memory reset still applies */ }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useSettings(): [KioskSettings, (patch: Partial<KioskSettings>) => void] {
  const snapshot = useSyncExternalStore(subscribe, getSettings, getSettings);
  const update = useCallback((patch: Partial<KioskSettings>) => setSettings(patch), []);
  return [snapshot, update];
}

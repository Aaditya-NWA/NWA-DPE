import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TICK_MS } from '../constants/system';

export function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export interface ValueTween {
  run: (from: number, to: number) => void;
  stop: () => void;
}

// Imperative so a slider can take the value over mid-flight by calling stop().
export function useValueTween(apply: (v: number) => void, durationSec: number): ValueTween {
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const durationRef = useRef(durationSec);
  durationRef.current = durationSec;
  const timerRef = useRef(0);

  const stop = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const run = useCallback((from: number, to: number) => {
    stop();
    const duration = durationRef.current;
    if (duration <= 0 || from === to) {
      applyRef.current(to);
      return;
    }
    const started = performance.now();
    timerRef.current = window.setInterval(() => {
      const t = (performance.now() - started) / (duration * 1000);
      if (t >= 1) {
        stop();
        applyRef.current(to);
        return;
      }
      applyRef.current(from + (to - from) * smoothstep(t));
    }, TICK_MS);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return useMemo(() => ({ run, stop }), [run, stop]);
}

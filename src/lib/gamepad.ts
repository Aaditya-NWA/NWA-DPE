import { useEffect, useRef, useState } from 'react';
import { GAMEPAD_BUTTONS, GAMEPAD_DEAD_ZONE, GAMEPAD_DIAL_AXIS } from '../constants/system';

export type GamepadAction = keyof typeof GAMEPAD_BUTTONS;

export interface GamepadHandlers {
  onPress?: (action: GamepadAction) => void;
  onDial?: (value: number) => void;
}

// Polled every frame (the Gamepad API has no input events); presses are edge-detected.
export function useGamepad(enabled: boolean, handlers: GamepadHandlers): { connected: string | null } {
  const [connected, setConnected] = useState<string | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const connectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    let raf = 0;
    const prevPressed = new Map<number, boolean>();
    let prevDialActive = false;

    const setDevice = (id: string | null) => {
      if (connectedRef.current === id) return;
      connectedRef.current = id;
      setConnected(id);
    };

    function poll() {
      raf = requestAnimationFrame(poll);
      const pad = navigator.getGamepads().find((p): p is Gamepad => Boolean(p)) ?? null;
      if (!pad) {
        setDevice(null);
        return;
      }
      setDevice(pad.id);

      for (const [action, index] of Object.entries(GAMEPAD_BUTTONS) as [GamepadAction, number][]) {
        const pressed = Boolean(pad.buttons[index]?.pressed);
        if (pressed && !prevPressed.get(index)) handlersRef.current.onPress?.(action);
        prevPressed.set(index, pressed);
      }

      const raw = pad.axes[GAMEPAD_DIAL_AXIS] ?? 0;
      const active = Math.abs(raw) > GAMEPAD_DEAD_ZONE;
      if (active) {
        const sign = raw < 0 ? -1 : 1;
        handlersRef.current.onDial?.(sign * ((Math.abs(raw) - GAMEPAD_DEAD_ZONE) / (1 - GAMEPAD_DEAD_ZONE)));
      } else if (prevDialActive) {
        handlersRef.current.onDial?.(0);
      }
      prevDialActive = active;
    }

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [enabled]);

  return { connected };
}

import { useCallback, useEffect, useState } from 'react';

// Full-screens the whole document so fixed overlays (settings, capture preview) stay visible.
interface WebkitFullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}
interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function currentFullscreenElement(): Element | null {
  const d = document as WebkitFullscreenDocument;
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

function fullscreenSupported(): boolean {
  const el = document.documentElement as WebkitFullscreenElement;
  return typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function';
}

export function useFullscreen(): { active: boolean; supported: boolean; toggle: () => void } {
  const [active, setActive] = useState(() => currentFullscreenElement() !== null);
  const [supported] = useState(() => fullscreenSupported());

  useEffect(() => {
    const onChange = () => setActive(currentFullscreenElement() !== null);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggle = useCallback(() => {
    const d = document as WebkitFullscreenDocument;
    const el = document.documentElement as WebkitFullscreenElement;
    try {
      if (currentFullscreenElement()) {
        const exit = document.exitFullscreen?.bind(document) ?? d.webkitExitFullscreen?.bind(d);
        void Promise.resolve(exit?.());
      } else {
        const enter = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
        void Promise.resolve(enter?.()).catch((err) => {
          console.warn('[fullscreen] the browser refused to enter full screen', err);
        });
      }
    } catch (err) {
      console.warn('[fullscreen] toggle failed', err);
    }
  }, []);

  return { active, supported, toggle };
}

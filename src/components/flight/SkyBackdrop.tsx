import type { ReactNode } from 'react';
import { SKY_PALETTE, SKY_STARS } from '../../constants/flight';

type Stop = [number, [number, number, number]];

function rampColor(frac: number, stops: Stop[]): string {
  const f = Math.max(0, Math.min(1, frac));
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (f >= stops[i][0] && f <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const span = hi[0] - lo[0];
  const k = span > 0 ? (f - lo[0]) / span : 0;
  const c = lo[1].map((v, i) => Math.round(v + (hi[1][i] - v) * k));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const fadeIn = (f: number, from: number, to: number) => Math.max(0, Math.min(1, (f - from) / (to - from)));
const fadeThrough = (f: number, from: number, peak: number, to: number) =>
  (f < peak ? fadeIn(f, from, peak) : 1 - fadeIn(f, peak, to));

// Parallax scenery: nearer layers fall away faster as altitude rises, which reads as height.
export default function SkyBackdrop({ altitudeFrac }: { altitudeFrac: number }) {
  const f = Math.max(0, Math.min(1, altitudeFrac));
  const skyTop = rampColor(f, SKY_PALETTE.top);
  const skyBottom = rampColor(f, SKY_PALETTE.bottom);
  const slide = (rate: number) => `translateY(${(f * rate * 100).toFixed(2)}%)`;

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${skyTop} 0%, ${skyBottom} 100%)` }} />

      <div style={{ position: 'absolute', inset: 0, opacity: fadeIn(f, 0.35, 0.95) }}>
        {SKY_STARS.map(([x, y, size]) => (
          <span
            key={`${x}-${y}`}
            style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: '50%', background: SKY_PALETTE.star }}
          />
        ))}
      </div>

      <Layer transform={slide(0.55)} opacity={1 - fadeIn(f, 0.55, 0.95) * 0.85}>
        <path d="M0,100 L0,62 L9,44 L17,55 L26,33 L36,52 L45,40 L55,58 L64,36 L74,54 L83,46 L92,60 L100,50 L100,100 Z" fill={SKY_PALETTE.farMountains} />
        <path d="M26,33 L30,39 L22,39 Z M64,36 L68,42 L60,42 Z" fill={SKY_PALETTE.snowCaps} />
      </Layer>

      <Layer transform={slide(0.85)} opacity={1 - fadeIn(f, 0.4, 0.78) * 0.95}>
        <path d="M0,100 L0,74 L12,62 L24,72 L34,58 L46,70 L58,60 L70,73 L82,64 L94,74 L100,68 L100,100 Z" fill={SKY_PALETTE.hills} />
      </Layer>

      <Layer transform={slide(1.25)} opacity={1 - fadeIn(f, 0.16, 0.42)}>
        <path d="M0,100 L0,86 L100,82 L100,100 Z" fill={SKY_PALETTE.groundFar} />
        <path d="M0,100 L0,93 L100,90 L100,100 Z" fill={SKY_PALETTE.groundNear} />
        <path d="M8,88 l3,-5 l3,5 Z M20,86 l3,-5 l3,5 Z M56,85 l3,-5 l3,5 Z M78,84 l3,-5 l3,5 Z" fill={SKY_PALETTE.trees} />
      </Layer>

      <Layer transform={slide(1.9)} opacity={fadeThrough(f, 0.12, 0.34, 0.66) * 0.9}>
        <g fill={SKY_PALETTE.cloud}>
          <ellipse cx="18" cy="44" rx="16" ry="4.5" />
          <ellipse cx="30" cy="47" rx="12" ry="3.6" />
          <ellipse cx="63" cy="40" rx="18" ry="5" />
          <ellipse cx="78" cy="44" rx="13" ry="3.8" />
        </g>
      </Layer>

      <Layer transform={slide(0.3)} opacity={fadeIn(f, 0.62, 0.9) * 0.5}>
        <g fill={SKY_PALETTE.cirrus}>
          <ellipse cx="26" cy="22" rx="22" ry="1.6" />
          <ellipse cx="70" cy="14" rx="18" ry="1.3" />
          <ellipse cx="52" cy="30" rx="14" ry="1.1" />
        </g>
      </Layer>

      <div style={{ position: 'absolute', inset: 0, background: SKY_PALETTE.scrim }} />
    </div>
  );
}

function Layer({ transform, opacity, children }: { transform: string; opacity: number; children: ReactNode }) {
  if (opacity <= 0.01) return null;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform, opacity }}
    >
      {children}
    </svg>
  );
}

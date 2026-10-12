import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { LABELS } from '../../constants/viewer';
import { theme } from '../../constants/theme';
import type { LabelPalette } from '../../constants/theme';

export interface LabelAnchor {
  key: string;
  text: string;
  pos: THREE.Vector3;
}

export interface LabelInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface Placed {
  key: string;
  x: number;
  y: number;
  dir: -1 | 1;
  labelY: number;
  visible: boolean;
}

/*
 * Lays labels out in SCREEN space each frame: project anchors, split by viewport
 * half, stack each column apart. Chips move, dots stay; leaders stretch.
 * Writes DOM styles from useFrame — never React state.
 */
export default function LabelLayer({ anchors, selectedKeys, palette, inset, onPick }: {
  anchors: LabelAnchor[];
  selectedKeys: Set<string> | null;
  palette: LabelPalette;
  inset: LabelInset;
  onPick?: (nodeName: string, canonicalKey: string) => void;
}) {
  const size = useThree((s) => s.size);
  const chips = useRef(new Map<string, HTMLDivElement | null>());
  const lines = useRef(new Map<string, SVGLineElement | null>());
  const dots = useRef(new Map<string, SVGCircleElement | null>());
  const scratch = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    if (anchors.length === 0) return;
    const v = scratch.current;
    const margin = LABELS.offscreenMarginPx;

    const placed: Placed[] = anchors.map((a) => {
      v.copy(a.pos).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      return {
        key: a.key,
        x,
        y,
        dir: x < size.width / 2 ? -1 : 1,
        labelY: y,
        visible: v.z < 1
          && Number.isFinite(x) && Number.isFinite(y)
          && x > -margin && x < size.width + margin
          && y > -margin && y < size.height + margin,
      };
    });

    for (const dir of [-1, 1] as const) {
      const column = placed.filter((p) => p.visible && p.dir === dir).sort((a, b) => a.y - b.y);
      let prev = -Infinity;
      for (const p of column) {
        p.labelY = Math.max(p.y, prev + LABELS.rowPx, inset.top);
        prev = p.labelY;
      }
      const overflow = prev - (size.height - inset.bottom);
      if (overflow > 0) {
        for (const p of column) p.labelY = Math.max(inset.top, p.labelY - overflow);
      }
    }

    for (const p of placed) {
      const chip = chips.current.get(p.key);
      const line = lines.current.get(p.key);
      const dot = dots.current.get(p.key);
      if (!chip) continue;

      const display = p.visible ? '' : 'none';
      chip.style.display = display;
      if (line) line.style.display = display;
      if (dot) dot.style.display = display;
      if (!p.visible) continue;

      const width = chip.offsetWidth || LABELS.fallbackChipWidth;
      let labelX = p.x + p.dir * LABELS.leaderPx;
      labelX = p.dir === -1
        ? Math.max(labelX, inset.left + width)
        : Math.min(labelX, size.width - inset.right - width);

      chip.style.transform = `translate(${labelX}px, ${p.labelY}px) translate(${p.dir === -1 ? '-100%' : '0'}, -50%)`;

      if (dot) { dot.setAttribute('cx', String(p.x)); dot.setAttribute('cy', String(p.y)); }
      if (line) {
        line.setAttribute('x1', String(p.x));
        line.setAttribute('y1', String(p.y));
        line.setAttribute('x2', String(labelX));
        line.setAttribute('y2', String(p.labelY));
      }
    }
  });

  if (anchors.length === 0) return null;

  return (
    <Html
      calculatePosition={() => [0, 0]}
      zIndexRange={[30, 0]}
      style={{
        position: 'absolute', top: 0, left: 0,
        width: size.width, height: size.height,
        pointerEvents: 'none', overflow: 'hidden',
      }}
    >
      <svg width={size.width} height={size.height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {anchors.map((a) => (
          <g key={a.key}>
            <line ref={(el) => { lines.current.set(a.key, el); }} stroke={palette.leader} strokeWidth={1} />
            <circle
              ref={(el) => { dots.current.set(a.key, el); }}
              r={3.5}
              fill={palette.accent}
              stroke={palette.dotHalo}
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>

      {anchors.map((a) => {
        const selected = Boolean(selectedKeys?.has(a.key));
        return (
          <div
            key={a.key}
            ref={(el) => { chips.current.set(a.key, el); }}
            role="button"
            tabIndex={0}
            onClick={() => onPick?.(a.key, a.key)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onPick?.(a.key, a.key); }}
            style={{
              position: 'absolute', top: 0, left: 0,
              background: selected ? palette.accent : palette.bg,
              border: `1px solid ${selected ? palette.accent : palette.border}`,
              borderLeft: `3px solid ${palette.accent}`,
              borderRadius: 6,
              padding: '4px 9px',
              fontFamily: theme.font.ui,
              fontSize: 11.5,
              fontWeight: 500,
              lineHeight: 1.3,
              color: selected ? theme.color.textOnAccent : palette.text,
              whiteSpace: 'nowrap',
              boxShadow: palette.shadow,
              backdropFilter: 'blur(8px)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            {a.text}
          </div>
        );
      })}
    </Html>
  );
}

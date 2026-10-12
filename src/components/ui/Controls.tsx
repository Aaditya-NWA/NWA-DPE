import { useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../constants/theme';
import { monoStyle, provenanceBadgeStyle } from '../../styles/primitives';
import type { Provenance, SpecEntry } from '../../types/product';

// Exclusivity is structural: exactly one segment is always chosen.
export function SegmentedToggle({ options, value, onChange, compact = false }: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  const height = compact ? 30 : theme.touchTarget;
  return (
    <div
      role="group"
      style={{
        display: 'inline-flex', padding: 4, gap: 4,
        borderRadius: theme.radius.md,
        background: compact ? theme.color.surface : theme.color.glass,
        border: theme.hairline,
        backdropFilter: theme.blur,
        boxShadow: compact ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.35)',
      }}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            style={{
              minHeight: height - 8,
              padding: compact ? '0 12px' : '0 16px',
              fontSize: compact ? 10.5 : 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              borderRadius: theme.radius.sm - 1,
              border: 'none',
              cursor: 'pointer',
              background: active ? theme.color.accent : 'transparent',
              color: active ? theme.color.textOnAccent : theme.color.textSub,
              transition: 'background 200ms, color 200ms',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// Always renders; an unmarked figure defaults to placeholder.
export function ProvenanceBadge({ provenance }: { provenance?: Provenance }) {
  const p = provenance ?? 'placeholder';
  return <span style={provenanceBadgeStyle(p)}>{p === 'measured' ? 'MEASURED' : 'PLACEHOLDER'}</span>;
}

export function SpecList({ specs, compact = false }: { specs: SpecEntry[]; compact?: boolean }) {
  if (specs.length === 0) return null;
  const first = specs[0].provenance ?? 'placeholder';
  const allSame = specs.every((s) => (s.provenance ?? 'placeholder') === first);
  return (
    <div>
      <div style={{ display: 'grid', gap: 7 }}>
        {specs.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: theme.color.textMuted }}>{s.label}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ ...monoStyle, fontSize: 12.5, color: theme.color.text }}>{s.value}</span>
              {!compact && !allSame && <ProvenanceBadge provenance={s.provenance} />}
            </span>
          </div>
        ))}
      </div>
      {(compact || allSame) && (
        <div style={{ marginTop: 10 }}>
          <ProvenanceBadge provenance={specs[0].provenance} />
        </div>
      )}
    </div>
  );
}

// Click to open — the kiosk has no hover.
export function WhyNote({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
          color: theme.color.accent, textAlign: 'left',
        }}
      >
        {open ? '▾' : '▸'} {label}
      </button>
      {open && (
        <div style={{
          background: theme.color.sunken, border: theme.hairline, borderRadius: theme.radius.sm,
          padding: '10px 12px', fontSize: 12.5, lineHeight: 1.6, color: theme.color.textSub,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function RangeInput({ value, min, max, step = 1, onChange, width = 260, disabled }: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  width?: number | string;
  disabled?: boolean;
}) {
  return (
    <input
      className="nw-range"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ width, display: 'block' }}
    />
  );
}

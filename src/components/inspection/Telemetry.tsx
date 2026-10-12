import { useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../constants/theme';
import { RPM } from '../../constants/viewer';
import { dividerStyle, microLabelStyle, monoStyle, overlayPanelStyle } from '../../styles/primitives';
import { RangeInput, SegmentedToggle } from '../ui/Controls';
import type { ExplodeMode } from '../../types/product';

const SLIDER_WIDTH = 260;

// Collapsible; defaults open because these are the controls the screen exists to offer.
export function TelemetryPanel({ children, title = 'CONTROLS' }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{
      ...overlayPanelStyle(),
      position: 'absolute', bottom: 24, right: 24,
      maxHeight: 'calc(100% - 48px)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          minHeight: 38, padding: open ? '12px 20px 2px' : '0 20px',
          background: 'none', border: 'none', cursor: 'pointer', width: '100%',
          ...microLabelStyle,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: theme.color.accent }} />
          {title}
        </span>
        <span style={{ color: theme.color.accent, fontSize: 12 }}>{open ? '▾' : '▴'}</span>
      </button>
      {open && (
        <div style={{ padding: '10px 20px 20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export function TelemetryDivider() {
  return <div style={dividerStyle} />;
}

function TelemetryRow({ readout, label, hint, caption, children }: {
  readout: string;
  label: string;
  hint?: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', width: SLIDER_WIDTH }}>
        <div style={{ ...monoStyle, fontSize: 28, fontWeight: 500, color: theme.color.accentBright, lineHeight: 1 }}>{readout}</div>
        {hint && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: theme.color.accent,
            background: theme.color.accentGlow, border: `1px solid ${theme.color.accentSoft}`,
            borderRadius: theme.radius.pill, padding: '2px 8px',
          }}>
            {hint}
          </span>
        )}
      </div>
      <div style={{ ...microLabelStyle, margin: '7px 0 10px' }}>{label}</div>
      {children}
      {caption && (
        <div style={{ width: SLIDER_WIDTH, fontSize: 11, lineHeight: 1.5, color: theme.color.textMuted, marginTop: 8 }}>
          {caption}
        </div>
      )}
    </div>
  );
}

export function RpmRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <TelemetryRow readout={String(value).padStart(3, '0')} label="RPM">
      <RangeInput min={0} max={RPM.max} value={value} onChange={onChange} width={SLIDER_WIDTH} />
    </TelemetryRow>
  );
}

export function PitchRow({ value, max, onChange, caption }: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  caption?: string;
}) {
  const state = value === 0 ? 'NEUTRAL' : value < 0 ? 'FINE' : 'COARSE';
  const meaning = value === 0
    ? 'As-designed blade angle.'
    : value < 0
      ? 'Flatter blades, biting less air — takeoff and landing, high RPM.'
      : 'Steeper blades, biting more air — cruise, lower RPM.';
  return (
    <TelemetryRow
      readout={`${value > 0 ? '+' : ''}${value}°`}
      label="BLADE PITCH"
      hint={state}
      caption={caption ? `${meaning} ${caption}` : meaning}
    >
      <RangeInput min={-max} max={max} value={value} onChange={onChange} width={SLIDER_WIDTH} />
      <div style={{
        display: 'flex', justifyContent: 'space-between', width: SLIDER_WIDTH,
        fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: theme.color.textMuted, marginTop: 4,
      }}>
        <span>FINE</span><span>0</span><span>COARSE</span>
      </div>
    </TelemetryRow>
  );
}

export function ExplodeSlider({ value, onChange, mode, onModeChange }: {
  value: number;
  onChange: (v: number) => void;
  mode?: ExplodeMode;
  onModeChange?: (mode: ExplodeMode) => void;
}) {
  const caption = mode === undefined
    ? undefined
    : mode === 'axial'
      ? 'Layered — parts separate along the assembly’s thin axis, keeping their in-plane arrangement.'
      : 'Radial — every solid moves outward from the assembly centre.';
  return (
    <TelemetryRow readout={`${Math.round(value * 100)}%`} label="EXPLODE" caption={caption}>
      <RangeInput min={0} max={1} step={0.01} value={value} onChange={onChange} width={SLIDER_WIDTH} />
      {mode && onModeChange && (
        <div style={{ marginTop: 12 }}>
          <SegmentedToggle
            compact
            value={mode}
            onChange={(id) => onModeChange(id as ExplodeMode)}
            options={[{ id: 'radial', label: 'RADIAL' }, { id: 'axial', label: 'LAYERED' }]}
          />
        </div>
      )}
    </TelemetryRow>
  );
}

export function XrayRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const state = value === 0 ? 'OFF' : value > 0.85 ? 'FULL' : 'PARTIAL';
  return (
    <TelemetryRow
      readout={`${Math.round(value * 100)}%`}
      label="X-RAY"
      hint={state}
      caption={value === 0
        ? 'Fade the airframe to see a selected part in place.'
        : 'Everything but the selection is transparent. Nothing has been removed.'}
    >
      <RangeInput min={0} max={1} step={0.01} value={value} onChange={onChange} width={SLIDER_WIDTH} />
    </TelemetryRow>
  );
}

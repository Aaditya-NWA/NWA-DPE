import { theme } from '../../constants/theme';
import { eyebrowStyle, microLabelStyle, monoStyle, overlayPanelStyle } from '../../styles/primitives';
import { ChromeButton, PrimaryButton } from '../ui/Buttons';
import type { CaptureResult } from '../../lib/capture';
import type { PerfSample } from './PerfProbe';

export type ViewerFault = 'context-lost' | 'hung';

const scrim = 'rgba(2, 8, 20, 0.9)';

export function LoadingOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      background: scrim, pointerEvents: 'none',
    }}>
      <div style={{ ...eyebrowStyle, letterSpacing: '0.24em' }}>Loading model</div>
      <div style={{ width: 260, height: 3, borderRadius: 2, overflow: 'hidden', background: theme.color.border }}>
        <div style={{
          width: '33%', height: '100%', background: theme.gradient.brand,
          animation: 'nw-indeterminate 1.1s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

export function FaultPanel({ fault, onRebuild, onDismiss }: {
  fault: ViewerFault;
  onRebuild: () => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      ...overlayPanelStyle(),
      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      padding: '24px 26px', maxWidth: 440, borderTop: `2px solid ${theme.color.danger}`,
    }}>
      <div style={{ ...eyebrowStyle, color: theme.color.danger, marginBottom: 10 }}>
        {fault === 'context-lost' ? 'WebGL context lost' : 'Renderer not responding'}
      </div>
      <div style={{ fontSize: 14, color: theme.color.textSub, lineHeight: 1.6, marginBottom: 18 }}>
        {fault === 'context-lost'
          ? 'The graphics context was dropped by the driver. The viewport has to be rebuilt — nothing else on the kiosk is affected.'
          : 'No frames have been drawn for several seconds while this tab was in the foreground. Rebuilding the viewport usually clears it.'}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <PrimaryButton onClick={onRebuild}>Rebuild viewport</PrimaryButton>
        <ChromeButton label="DISMISS" onClick={onDismiss} />
      </div>
    </div>
  );
}

export function CapturePreview({ preview, onSave, onDiscard }: {
  preview: CaptureResult;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
      background: scrim, backdropFilter: 'blur(6px)',
    }}>
      <img
        src={preview.dataUrl}
        alt="Captured viewport"
        style={{
          flex: '1 1 auto', minHeight: 0, maxWidth: '100%', objectFit: 'contain',
          border: theme.hairline, borderRadius: theme.radius.lg, boxShadow: theme.shadow.panel,
        }}
      />
      <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'center' }}>
        <PrimaryButton onClick={onSave}>Save image</PrimaryButton>
        <ChromeButton label="DISCARD" onClick={onDiscard} />
      </div>
    </div>
  );
}

export function PerfReadout({ perf, fetchInfo, loadMs }: {
  perf: PerfSample | null;
  fetchInfo: { ms: number; bytes: number; cached: boolean } | null;
  loadMs: number | null;
}) {
  const rows: [string, string][] = [
    ['FPS', perf ? perf.fps.toFixed(1) : '—'],
    ['TRIANGLES', perf ? perf.triangles.toLocaleString() : '—'],
    ['DRAW CALLS', perf ? perf.drawCalls.toLocaleString() : '—'],
    ['GEOMETRIES', perf ? perf.geometries.toLocaleString() : '—'],
    ['TEXTURES', perf ? perf.textures.toLocaleString() : '—'],
    ['MODEL', fetchInfo ? `${(fetchInfo.bytes / 1048576).toFixed(1)} MB` : '—'],
    ['FETCH', fetchInfo ? (fetchInfo.cached ? 'CACHED' : `${fetchInfo.ms.toFixed(0)} ms`) : '—'],
    ['LOAD', loadMs !== null ? `${loadMs.toFixed(0)} ms` : '—'],
  ];
  return (
    <div
      data-testid="perf-readout"
      style={{
        ...overlayPanelStyle(),
        position: 'absolute', top: 24 + theme.touchTarget + 12, right: 24,
        padding: '14px 18px', minWidth: 220, lineHeight: 1.95,
      }}
    >
      {rows.map(([label, value]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 18 }}>
          <span style={{ ...microLabelStyle, fontSize: 10 }}>{label}</span>
          <span style={{ ...monoStyle, fontSize: 11.5, color: theme.color.accentBright }}>{value}</span>
        </div>
      ))}
    </div>
  );
}

export function GestureHint() {
  return (
    <div style={{
      ...overlayPanelStyle(),
      position: 'absolute', top: 24 + theme.touchTarget + 16, left: 24, padding: '12px 16px',
      fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', lineHeight: 1.9, color: theme.color.accentBright,
    }}>
      <div>PINCH — SEPARATE PARTS</div>
      <div>TWIST — SPIN ROTORS</div>
      <div style={{ color: theme.color.textMuted }}>ORBIT PAUSED WHILE ON</div>
    </div>
  );
}

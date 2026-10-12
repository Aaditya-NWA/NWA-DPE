import type { CSSProperties } from 'react';
import { theme } from '../../constants/theme';
import { HUMAN_HEIGHT_M } from '../../constants/viewer';
import { microLabelStyle, monoStyle, overlayPanelStyle } from '../../styles/primitives';
import { useSettings } from '../../lib/settings';
import { formatLength } from '../../lib/format';
import { ProvenanceBadge } from '../ui/Controls';
import type { PhysicalProfile } from '../../types/product';

const DRAWING_HEIGHT = 62;
const GROUND_Y = 66;

// A ratio against a person is camera-independent, so it cannot drift with zoom.
export default function ScaleReference({ sizeUnits, productMaxDimUnits, physical, subjectLabel }: {
  sizeUnits: { x: number; y: number; z: number } | null;
  productMaxDimUnits: number | null;
  physical?: PhysicalProfile;
  subjectLabel: string;
}) {
  const [settings, updateSettings] = useSettings();
  const open = settings.scaleReferenceOpen;

  const panelStyle: CSSProperties = {
    ...overlayPanelStyle(),
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    maxWidth: 'min(470px, calc(100% - 48px))',
  };

  if (!sizeUnits || !productMaxDimUnits || productMaxDimUnits <= 0 || !physical) {
    return (
      <div style={panelStyle}>
        <div style={{ fontSize: 12, color: theme.color.textMuted, lineHeight: 1.5 }}>
          <strong style={{ color: theme.color.textSub }}>Scale unavailable.</strong>{' '}
          This product publishes no real-world dimension, so the viewer cannot say how big it is.
        </div>
      </div>
    );
  }

  const metresPerUnit = physical.spanM / productMaxDimUnits;
  const w = sizeUnits.x * metresPerUnit;
  const h = sizeUnits.y * metresPerUnit;
  const d = sizeUnits.z * metresPerUnit;
  const longest = Math.max(w, h, d);

  if (!open) {
    return (
      <button
        onClick={() => updateSettings({ scaleReferenceOpen: true })}
        aria-expanded={false}
        style={{ ...panelStyle, padding: '0 16px', minHeight: 36, gap: 10, cursor: 'pointer' }}
      >
        <span style={microLabelStyle}>Scale</span>
        <span style={{ ...monoStyle, fontSize: 12, color: theme.color.accentBright }}>{formatLength(longest)}</span>
        <span style={{ color: theme.color.accent, fontSize: 12 }}>▴</span>
      </button>
    );
  }

  const px = DRAWING_HEIGHT / Math.max(HUMAN_HEIGHT_M, h);
  const humanH = HUMAN_HEIGHT_M * px;
  const boxH = Math.max(2, h * px);
  const boxW = Math.max(2, Math.min(96, w * px));

  return (
    <div style={panelStyle}>
      <svg width={boxW + 30} height={70} viewBox={`0 0 ${boxW + 30} 70`} aria-hidden="true" style={{ flexShrink: 0 }}>
        <line x1="0" y1={GROUND_Y} x2={boxW + 30} y2={GROUND_Y} stroke={theme.color.border} strokeWidth="1" />
        <g stroke={theme.color.textMuted} strokeWidth="1.5" fill="none" strokeLinecap="round">
          <circle cx="9" cy={GROUND_Y - humanH + humanH * 0.09} r={Math.max(1.6, humanH * 0.08)} />
          <line x1="9" y1={GROUND_Y - humanH + humanH * 0.2} x2="9" y2={GROUND_Y - humanH * 0.4} />
          <line x1="9" y1={GROUND_Y - humanH * 0.4} x2={9 - humanH * 0.11} y2={GROUND_Y} />
          <line x1="9" y1={GROUND_Y - humanH * 0.4} x2={9 + humanH * 0.11} y2={GROUND_Y} />
        </g>
        <rect
          x="24" y={GROUND_Y - boxH} width={boxW} height={boxH}
          fill={theme.color.accentGlow} stroke={theme.color.accent} strokeWidth="1.2" rx="1.5"
        />
      </svg>

      <div style={{ minWidth: 0 }}>
        <div style={{ ...microLabelStyle, fontSize: 9.5, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Scale · {subjectLabel}
        </div>
        <div style={{ ...monoStyle, fontSize: 15, color: theme.color.text }}>
          {formatLength(longest)}
          <span style={{ fontSize: 11, color: theme.color.textMuted }}> longest</span>
        </div>
        <div style={{ ...monoStyle, fontSize: 10.5, color: theme.color.textMuted, marginTop: 2 }}>
          {formatLength(w)} × {formatLength(h)} × {formatLength(d)}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ProvenanceBadge provenance={physical.provenance} />
          <span style={{ fontSize: 10.5, color: theme.color.textMuted }}>vs {HUMAN_HEIGHT_M} m person</span>
        </div>
      </div>

      <button
        onClick={() => updateSettings({ scaleReferenceOpen: false })}
        aria-label="Collapse the scale reference"
        aria-expanded
        style={{
          alignSelf: 'stretch', minWidth: 34, padding: '0 4px',
          background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: theme.color.accent,
        }}
      >
        ▾
      </button>
    </div>
  );
}

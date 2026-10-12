import { theme } from '../../constants/theme';
import { eyebrowStyle, monoStyle, overlayPanelStyle } from '../../styles/primitives';
import { ChromeButton } from '../ui/Buttons';
import type { PlaybackControls, PlaybackState } from '../../lib/scenario';

// Top-centre under the chrome row: the one region free of other overlays. `data-scenario-bar` exempts it from touch-to-stop.
export default function ScenarioBar({ state, controls, title }: {
  state: PlaybackState;
  controls: PlaybackControls;
  title: string;
}) {
  if (!state.active) return null;

  return (
    <div
      data-scenario-bar
      style={{
        ...overlayPanelStyle(),
        position: 'absolute', top: 24 + theme.touchTarget + 16, left: '50%', transform: 'translateX(-50%)',
        width: 'min(580px, calc(100% - 420px))', minWidth: 300,
        padding: '14px 18px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.color.accent, animation: 'nw-pulse 1.6s ease-in-out infinite' }} />
        <span style={{ ...eyebrowStyle, fontSize: 10.5 }}>{title}</span>
        <span style={{ ...monoStyle, fontSize: 10.5, color: theme.color.textMuted, marginLeft: 'auto' }}>
          {state.stepIndex + 1} / {state.stepCount}
        </span>
      </div>

      <div style={{ fontSize: 14.5, lineHeight: 1.55, color: theme.color.text, minHeight: 44 }}>{state.caption}</div>

      <div style={{ height: 3, background: theme.color.border, borderRadius: 2, margin: '10px 0 12px', overflow: 'hidden' }}>
        <div style={{ width: `${state.progress * 100}%`, height: '100%', background: theme.gradient.brand }} />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <ChromeButton label="‹ PREV" onClick={controls.prev} style={{ minHeight: 38, padding: '0 14px' }} />
        <ChromeButton label="NEXT ›" onClick={controls.next} style={{ minHeight: 38, padding: '0 14px' }} />
        <ChromeButton label="STOP TOUR" active onClick={controls.stop} style={{ minHeight: 38, padding: '0 16px', marginLeft: 'auto' }} />
      </div>
    </div>
  );
}

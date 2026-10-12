import { theme } from '../../constants/theme';
import { microLabelStyle, overlayPanelStyle } from '../../styles/primitives';
import type { PilotInput } from '../../lib/flight';

// Held, not clicked: leave/cancel release too, or a dragged-off press would climb forever.
function ArrowKey({ label, title, active, onPress, compact = false }: {
  label: string;
  title: string;
  active: boolean;
  onPress: (down: boolean) => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onPointerDown={(e) => { e.preventDefault(); onPress(true); }}
      onPointerUp={() => onPress(false)}
      onPointerLeave={() => onPress(false)}
      onPointerCancel={() => onPress(false)}
      style={{
        width: theme.touchTarget, height: compact ? 30 : theme.touchTarget + 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, lineHeight: 1,
        color: active ? theme.color.textOnAccent : theme.color.accentBright,
        background: active ? theme.color.accent : theme.color.surface,
        border: `1px solid ${active ? theme.color.accent : theme.color.border}`,
        boxShadow: active ? theme.shadow.accent : 'none',
        borderRadius: theme.radius.sm, cursor: 'pointer', touchAction: 'none', userSelect: 'none',
        transition: 'background 120ms',
      }}
    >
      {label}
    </button>
  );
}

export default function FlightControls({ held, onPress, phaseLabel, atCap }: {
  held: PilotInput;
  onPress: (k: keyof PilotInput, down: boolean) => void;
  phaseLabel: string;
  atCap: boolean;
}) {
  return (
    <div style={{
      ...overlayPanelStyle(),
      position: 'absolute', left: 78, right: 34, bottom: 20,
      display: 'flex', alignItems: 'center', gap: 24, padding: '12px 20px',
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <ArrowKey label="←" title="Brake" active={held.brake} onPress={(d) => onPress('brake', d)} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <ArrowKey label="↑" title="Climb" active={held.climb} onPress={(d) => onPress('climb', d)} compact />
          <ArrowKey label="↓" title="Descend" active={held.descend} onPress={(d) => onPress('descend', d)} compact />
        </div>
        <ArrowKey label="→" title="Accelerate" active={held.accelerate} onPress={(d) => onPress('accelerate', d)} />
      </div>

      <div style={{ fontSize: 12.5, lineHeight: 1.6, color: theme.color.textMuted }}>
        <strong style={{ color: theme.color.text, fontWeight: 600 }}>Hold the arrow keys to fly.</strong>{' '}
        Up and down climb and descend; right and left accelerate and brake.
        Hold up and right together to climb out along the envelope. Let go and it stays exactly where you left it.
      </div>

      <div style={{ marginLeft: 'auto', minWidth: 160, textAlign: 'right' }}>
        <div style={microLabelStyle}>Phase</div>
        <div style={{
          fontSize: 15, fontWeight: 700, letterSpacing: '0.06em', marginTop: 4,
          color: atCap ? theme.color.amber : theme.color.accentBright,
        }}>
          {atCap ? 'CEILING LOCKED' : phaseLabel}
        </div>
      </div>
    </div>
  );
}

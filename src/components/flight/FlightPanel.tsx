import { theme } from '../../constants/theme';
import { eyebrowStyle, microLabelStyle, monoStyle } from '../../styles/primitives';
import { GhostButton } from '../ui/Buttons';
import type { FlightVector } from '../../lib/flight';
import type { FlightEnvelope, FlightPhase, ProductConfig } from '../../types/product';

function Readout({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '6px 0' }}>
      <span style={microLabelStyle}>{label}</span>
      <span style={{
        ...monoStyle, fontSize: big ? 24 : 14, fontWeight: big ? 600 : 400,
        color: big ? theme.color.accentBright : theme.color.text,
      }}>
        {value}
      </span>
    </div>
  );
}

function PhaseRow({ phase }: { phase: FlightPhase }) {
  const rows: [string, string][] = [
    ['Altitude', `${phase.altitudeM.toLocaleString()} m`],
    ['Velocity', `${phase.velocityMs} m/s`],
    ['Thrust', `${phase.thrustN} N`],
    ['Drag', `${phase.dragN} N`],
  ];
  return (
    <div style={{ padding: '12px 14px', marginBottom: 8, background: theme.color.card, border: theme.hairline, borderRadius: theme.radius.md }}>
      <div style={{ ...eyebrowStyle, fontSize: 10.5, marginBottom: 8 }}>{phase.label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 12px', fontSize: 12, color: theme.color.textSub }}>
        {rows.map(([label, value]) => (
          <span key={label} style={{ display: 'contents' }}>
            <span>{label}</span>
            <span style={{ ...monoStyle, textAlign: 'right', color: theme.color.text }}>{value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function FlightPanel({ product, envelope, flight, thrustN, dragN, rpm, tilt, onExit }: {
  product: ProductConfig;
  envelope: FlightEnvelope;
  flight: FlightVector;
  thrustN: number;
  dragN: number;
  rpm: number;
  tilt: number;
  onExit: () => void;
}) {
  const takeoff = envelope.phases[0];
  const cruise = envelope.phases.find((p) => p.label === 'CRUISE') ?? envelope.phases[Math.floor(envelope.phases.length / 2)];
  const divider = { height: 1, background: theme.color.border, margin: '16px 0' };

  return (
    <aside style={{
      width: 340, flexShrink: 0, height: '100%', overflow: 'auto',
      padding: '28px 26px 26px', background: theme.color.surface, borderLeft: theme.hairline,
    }}>
      <div style={eyebrowStyle}>Flight envelope</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: theme.color.text, margin: '8px 0 18px', letterSpacing: '-0.01em' }}>
        {product.label}
      </div>

      <Readout label="Altitude" value={`${Math.round(flight.altitudeM).toLocaleString()} m`} big />
      <Readout label="Velocity" value={`${flight.velocityMs.toFixed(1)} m/s`} big />

      <div style={divider} />

      <Readout label="Thrust" value={`${thrustN.toFixed(1)} N`} />
      <Readout label="Drag" value={`${dragN.toFixed(1)} N`} />
      <Readout label="Rotor speed" value={`${rpm} rpm`} />
      <Readout label="Disc tilt" value={`${tilt.toFixed(1)}°`} />

      <p style={{ fontSize: 12, lineHeight: 1.6, color: theme.color.textMuted, margin: '10px 0 0' }}>
        A multirotor has no variable pitch — it leans the whole airframe, and every rotor disc with it, into the
        relative wind. Faster cruise, steeper lean.
      </p>

      <div style={{ ...divider, margin: '18px 0 14px' }} />

      <div style={{ ...microLabelStyle, marginBottom: 10 }}>Reference points</div>
      <PhaseRow phase={takeoff} />
      <PhaseRow phase={cruise} />

      <p style={{
        fontSize: 11.5, lineHeight: 1.55, color: theme.color.textMuted, margin: '14px 0 0', padding: '9px 11px',
        background: theme.color.placeholderBg, border: `1px solid ${theme.color.placeholder}33`, borderRadius: theme.radius.sm,
      }}>
        Illustrative figures for a demonstration airframe — not published specifications. Climb and acceleration
        rates are time-compressed.
      </p>

      <GhostButton onClick={onExit} style={{ marginTop: 20, width: '100%' }}>← Exit flight</GhostButton>
    </aside>
  );
}

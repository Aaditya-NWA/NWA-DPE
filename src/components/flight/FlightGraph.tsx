import ShowcaseCanvas from '../engine/ShowcaseCanvas';
import SkyBackdrop from './SkyBackdrop';
import { theme } from '../../constants/theme';
import { GATE_ALTITUDE_M, PLOT } from '../../constants/flight';
import { SHOWCASE } from '../../constants/viewer';
import { microLabelStyle, monoStyle } from '../../styles/primitives';
import { tickValues } from '../../lib/flight';
import type { FlightEnvelope, RigSpin } from '../../types/product';

const GRID_LINE = 'rgba(126, 200, 216, 0.1)';

export interface AircraftMarker {
  x: number;
  y: number;
  url: string;
  rigs: RigSpin[] | null;
  rpm: number;
  tilt: number;
}

export default function FlightGraph({ envelope, trail, altitudeFrac, gateY, gateReleased, toX, toY, aircraft }: {
  envelope: FlightEnvelope;
  trail: string[];
  altitudeFrac: number;
  gateY: number | null;
  gateReleased: boolean;
  toX: (v: number) => number;
  toY: (a: number) => number;
  aircraft: AircraftMarker;
}) {
  const tickLabel = { ...monoStyle, fontSize: 10, color: theme.color.textMuted, whiteSpace: 'nowrap' } as const;
  const gateColor = gateReleased ? theme.color.accentBright : theme.color.amber;

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '28px 34px 128px 78px' }}>
      <div style={{
        ...microLabelStyle, position: 'absolute', left: 16, top: '50%',
        transform: 'translateY(-50%) rotate(-90deg)', whiteSpace: 'nowrap',
      }}>
        Altitude (m)
      </div>

      <div style={{
        position: 'relative', width: '100%', height: '100%', overflow: 'hidden',
        border: theme.hairline, borderRadius: theme.radius.xl, boxShadow: theme.shadow.card,
      }}>
        <SkyBackdrop altitudeFrac={altitudeFrac} />

        {tickValues(envelope.ceilingM).map((v) => (
          <div key={`a${v}`} style={{ position: 'absolute', left: 0, right: 0, top: `${toY(v)}%` }}>
            <div style={{ borderTop: `1px solid ${GRID_LINE}` }} />
            <div style={{ ...tickLabel, position: 'absolute', right: 'calc(100% + 10px)', transform: 'translateY(-50%)' }}>
              {v.toLocaleString()}
            </div>
          </div>
        ))}
        {tickValues(envelope.maxVelocityMs).map((v) => (
          <div key={`v${v}`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${toX(v)}%` }}>
            <div style={{ borderLeft: `1px solid ${GRID_LINE}`, height: '100%' }} />
            <div style={{ ...tickLabel, position: 'absolute', top: 'calc(100% + 8px)', transform: 'translateX(-50%)' }}>{v}</div>
          </div>
        ))}

        {gateY !== null && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${gateY}%` }}>
            <div style={{ borderTop: `2px dashed ${gateColor}`, opacity: 0.85 }} />
            <div style={{
              position: 'absolute', left: 12, top: 8, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em',
              color: gateColor, background: 'rgba(2, 8, 20, 0.6)', padding: '3px 8px', borderRadius: 6,
            }}>
              {GATE_ALTITUDE_M.toLocaleString()} M — {gateReleased ? 'RELEASED' : 'SIGN-IN REQUIRED ABOVE'}
            </div>
          </div>
        )}

        {trail.length > 1 && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <polyline
              points={trail.join(' ')}
              fill="none"
              stroke={theme.color.accentBright}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 6px rgba(126, 200, 216, 0.55))' }}
            />
          </svg>
        )}

        <div style={{
          position: 'absolute', left: `${aircraft.x}%`, top: `${aircraft.y}%`,
          width: PLOT.aircraftSizePx, height: PLOT.aircraftSizePx,
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }}>
          <ShowcaseCanvas
            url={aircraft.url}
            rigs={aircraft.rigs}
            rotorRpm={aircraft.rpm}
            tiltDeg={aircraft.tilt}
            margin={SHOWCASE.flightMargin}
          />
        </div>
      </div>

      <div style={{ ...microLabelStyle, position: 'absolute', left: 78, right: 34, bottom: 98, textAlign: 'center' }}>
        Velocity (m/s)
      </div>
    </div>
  );
}

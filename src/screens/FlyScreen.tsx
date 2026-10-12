import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AltitudeGate from '../components/auth/AltitudeGate';
import FlightGraph from '../components/flight/FlightGraph';
import FlightControls from '../components/flight/FlightControls';
import FlightPanel from '../components/flight/FlightPanel';
import { FLIGHT_TIMING, GATE_ALTITUDE_M, GATE_REARM_MARGIN_M, IDLE_INPUT, KEY_BINDINGS, PLOT } from '../constants/flight';
import { discTiltDeg, dragAtVelocity, phaseLabelAtAltitude, rotorRpm, step, thrustAtAltitude } from '../lib/flight';
import type { FlightVector, PilotInput } from '../lib/flight';
import { rigSpinsOf } from '../lib/metadata';
import type { MockSession } from '../lib/session';
import type { ProductConfig, ProductMetadataFile } from '../types/product';

// Two independent axes on the arrow keys; the graph shows the trail actually flown.
export default function FlyScreen({ product, metadata, session, onSignedIn, onExit }: {
  product: ProductConfig;
  metadata: ProductMetadataFile;
  session: MockSession | null;
  onSignedIn: (s: MockSession) => void;
  onExit: () => void;
}) {
  const envelope = metadata.website!.flight;

  const [flight, setFlight] = useState<FlightVector>({ altitudeM: 0, velocityMs: 0 });
  const [trail, setTrail] = useState<string[]>([]);
  const [gatePrompt, setGatePrompt] = useState(false);
  const [held, setHeld] = useState<PilotInput>(IDLE_INPUT);

  const rigs = useMemo(() => rigSpinsOf(metadata.parts), [metadata]);

  const altitudeCapM = session ? envelope.ceilingM : Math.min(GATE_ALTITUDE_M, envelope.ceilingM);
  const gateActive = !session && GATE_ALTITUDE_M < envelope.ceilingM;

  const toX = useCallback(
    (v: number) => PLOT.insetPct + (v / envelope.maxVelocityMs) * (100 - PLOT.insetPct * 2),
    [envelope.maxVelocityMs],
  );
  const toY = useCallback(
    (a: number) => 100 - PLOT.insetPct - (a / envelope.ceilingM) * (100 - PLOT.insetPct * 2),
    [envelope.ceilingM],
  );

  const inputRef = useRef<PilotInput>(IDLE_INPUT);
  const setInput = useCallback((k: keyof PilotInput, down: boolean) => {
    if (inputRef.current[k] === down) return;
    inputRef.current = { ...inputRef.current, [k]: down };
    setHeld(inputRef.current);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent, down: boolean) {
      const control = KEY_BINDINGS[e.key];
      if (!control) return;
      e.preventDefault();
      setInput(control, down);
    }
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      inputRef.current = IDLE_INPUT;
      setHeld(IDLE_INPUT);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [setInput]);

  const flightRef = useRef(flight);
  flightRef.current = flight;
  const capRef = useRef(altitudeCapM);
  capRef.current = altitudeCapM;
  const gateDismissedRef = useRef(false);
  const trailRef = useRef<{ pts: string[]; lastX: number; lastY: number }>({ pts: [], lastX: -99, lastY: -99 });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(FLIGHT_TIMING.maxFrameDt, (now - last) / 1000);
      last = now;

      const { next, blockedByCap } = step(flightRef.current, inputRef.current, envelope, capRef.current, dt);
      if (blockedByCap && !gateDismissedRef.current) setGatePrompt(true);
      if (next.altitudeM < GATE_ALTITUDE_M - GATE_REARM_MARGIN_M) gateDismissedRef.current = false;

      const x = toX(next.velocityMs);
      const y = toY(next.altitudeM);
      const t = trailRef.current;
      if (Math.hypot(x - t.lastX, y - t.lastY) >= PLOT.trailMinStep) {
        t.pts = [...t.pts, `${x.toFixed(2)},${y.toFixed(2)}`].slice(-PLOT.trailMaxPoints);
        t.lastX = x;
        t.lastY = y;
        setTrail(t.pts);
      }

      setFlight(next);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [envelope, toX, toY]);

  const thrustN = thrustAtAltitude(envelope, flight.altitudeM);
  const dragN = dragAtVelocity(envelope, flight.velocityMs);
  const tilt = discTiltDeg(flight.velocityMs, envelope.maxVelocityMs);
  const rpm = rotorRpm(thrustN, envelope);
  const atCap = gateActive && flight.altitudeM >= altitudeCapM - 1;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', overflow: 'hidden' }}>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <FlightGraph
          envelope={envelope}
          trail={trail}
          altitudeFrac={flight.altitudeM / envelope.ceilingM}
          gateY={gateActive || session ? toY(GATE_ALTITUDE_M) : null}
          gateReleased={Boolean(session)}
          toX={toX}
          toY={toY}
          aircraft={{ x: toX(flight.velocityMs), y: toY(flight.altitudeM), url: product.glbUrl, rigs, rpm, tilt }}
        />
        <FlightControls
          held={held}
          onPress={setInput}
          phaseLabel={phaseLabelAtAltitude(envelope, flight.altitudeM)}
          atCap={atCap}
        />
      </div>

      <FlightPanel
        product={product}
        envelope={envelope}
        flight={flight}
        thrustN={thrustN}
        dragN={dragN}
        rpm={rpm}
        tilt={tilt}
        onExit={onExit}
      />

      {gatePrompt && (
        <AltitudeGate
          gateAltitudeM={GATE_ALTITUDE_M}
          ceilingM={envelope.ceilingM}
          productLabel={product.label}
          onSignedIn={(s) => { setGatePrompt(false); onSignedIn(s); }}
          onDismiss={() => { setGatePrompt(false); gateDismissedRef.current = true; }}
        />
      )}
    </div>
  );
}

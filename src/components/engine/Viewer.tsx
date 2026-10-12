import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Center, Bounds, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { MOUSE, TOUCH } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import PerfProbe from './PerfProbe';
import type { PerfSample } from './PerfProbe';
import StudioLights from './StudioLights';
import { FocusFitter, FrameHeartbeat, TurntableRig, ViewResetter } from './CameraRigs';
import type { OrbitState } from './CameraRigs';
import { CapturePreview, FaultPanel, GestureHint, LoadingOverlay, PerfReadout } from './ViewerOverlays';
import type { ViewerFault } from './ViewerOverlays';
import { ChromeButton } from '../ui/Buttons';
import { captureViewport, downloadCapture } from '../../lib/capture';
import type { CaptionFields, CaptureResult } from '../../lib/capture';
import { useSettings } from '../../lib/settings';
import { onOff } from '../../lib/format';
import { CAMERA, TURNTABLE, WATCHDOG } from '../../constants/viewer';
import { theme } from '../../constants/theme';

export interface GestureHandlers {
  onPinch?: (delta: number) => void;
  onTwist?: (deltaDeg: number) => void;
}

interface ViewerProps {
  children: ReactNode;
  onPointerMissed?: () => void;
  extraControls?: ReactNode;
  autoRotate?: boolean;
  captureFields?: CaptionFields;
  gestures?: GestureHandlers;
  onContextLost?: () => void;
  focusBox?: THREE.Box3 | null;
}

interface FetchInfo {
  ms: number;
  bytes: number;
  cached: boolean;
}

function readLatestGlbTiming(): FetchInfo | null {
  const entries = performance
    .getEntriesByType('resource')
    .filter((e) => e.name.includes('.glb')) as PerformanceResourceTiming[];
  const last = entries[entries.length - 1];
  if (!last) return null;
  return { ms: last.duration, bytes: last.decodedBodySize, cached: last.transferSize === 0 && last.decodedBodySize > 0 };
}

// Inspection canvas: turntable orbit, chrome row, loading, timing, capture, gestures and the WebGL watchdog.
export default function Viewer({
  children,
  onPointerMissed,
  extraControls,
  autoRotate = false,
  captureFields,
  gestures,
  onContextLost,
  focusBox = null,
}: ViewerProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [panMode, setPanMode] = useState(false);
  const [perfOn, setPerfOn] = useState(false);
  const [perf, setPerf] = useState<PerfSample | null>(null);
  const [gesturesOn, setGesturesOn] = useState(false);
  const [preview, setPreview] = useState<CaptureResult | null>(null);
  const [fault, setFault] = useState<ViewerFault | null>(null);
  const [settings, updateSettings] = useSettings();
  const studio = settings.studio;
  const viewportColor = studio ? theme.studio.viewport : theme.color.viewport;

  const { active } = useProgress();

  // Subscribed to the store directly: React can coalesce a fast load's active transitions.
  const loadStartRef = useRef<number | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [fetchInfo, setFetchInfo] = useState<FetchInfo | null>(null);

  useEffect(() => {
    function onStoreChange(s: { active: boolean }) {
      if (s.active && loadStartRef.current === null) {
        loadStartRef.current = performance.now();
        setLoadMs(null);
      } else if (!s.active && loadStartRef.current !== null) {
        setLoadMs(performance.now() - loadStartRef.current);
        loadStartRef.current = null;
        const timing = readLatestGlbTiming();
        if (timing) setFetchInfo(timing);
      }
    }
    onStoreChange(useProgress.getState());
    return useProgress.subscribe(onStoreChange);
  }, []);

  const orbitRef = useRef<OrbitState>({
    dx: 0,
    dy: 0,
    targetAzimuth: 0,
    targetPolar: TURNTABLE.initialPolar,
    currentAzimuth: 0,
    currentPolar: TURNTABLE.initialPolar,
    driving: false,
  });
  const dragPointerRef = useRef<number | null>(null);
  const lastPointRef = useRef({ x: 0, y: 0 });

  const resetViewRef = useRef<(() => void) | null>(null);
  const resetView = useCallback(() => {
    orbitRef.current.dx = 0;
    orbitRef.current.dy = 0;
    orbitRef.current.driving = false;
    const doReset = resetViewRef.current;
    if (doReset) doReset();
    else controlsRef.current?.reset();
  }, []);

  // PAN switches which pointer the turntable listens to; rotation is never OrbitControls'.
  function togglePan() {
    const controls = controlsRef.current;
    if (!controls) return;
    const next = !panMode;
    setPanMode(next);
    dragPointerRef.current = null;
    controls.mouseButtons = {
      LEFT: next ? MOUSE.PAN : MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: next ? MOUSE.ROTATE : MOUSE.PAN,
    };
    controls.touches = { ONE: next ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
  }

  const lastFrameRef = useRef(performance.now());
  const noteFrame = useCallback(() => { lastFrameRef.current = performance.now(); }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const onLost = (e: Event) => {
      e.preventDefault();
      console.error('[Viewer] WebGL context lost — the viewport subtree must be remounted.');
      setFault('context-lost');
    };
    const onRestored = () => console.warn('[Viewer] WebGL context restored.');
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, []);

  // Hang watchdog: a hidden tab throttles rAF legitimately, and so does a load.
  useEffect(() => {
    const onVisibility = () => { lastFrameRef.current = performance.now(); };
    document.addEventListener('visibilitychange', onVisibility);
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || useProgress.getState().active) {
        lastFrameRef.current = performance.now();
        return;
      }
      if (performance.now() - lastFrameRef.current > WATCHDOG.hangTimeoutMs) {
        console.error(
          `[Viewer] no frame painted for over ${WATCHDOG.hangTimeoutMs}ms while the tab was visible — treating the renderer as hung.`,
        );
        setFault((f) => f ?? 'hung');
      }
    }, WATCHDOG.pollMs);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Gestures take two-finger touch away from OrbitControls; they cannot share it.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const spanRef = useRef<number | null>(null);
  const angleRef = useRef<number | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.enabled = !gesturesOn;
    if (gesturesOn) dragPointerRef.current = null;
  }, [gesturesOn]);

  const twoPointerMetrics = () => {
    const pts = [...pointersRef.current.values()];
    if (pts.length < 2) return null;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return { span: Math.hypot(dx, dy), angleDeg: (Math.atan2(dy, dx) * 180) / Math.PI };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesturesOn) {
      const m = twoPointerMetrics();
      spanRef.current = m?.span ?? null;
      angleRef.current = m?.angleDeg ?? null;
      return;
    }

    if (!(e.target instanceof HTMLCanvasElement)) return;
    if (pointersRef.current.size > 1) {
      dragPointerRef.current = null;
      return;
    }
    const wantsOrbit = panMode ? e.button === 2 : e.button === 0;
    if (!wantsOrbit) return;

    dragPointerRef.current = e.pointerId;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesturesOn) {
      const m = twoPointerMetrics();
      if (!m) return;
      if (spanRef.current !== null && spanRef.current > 0) {
        gestures?.onPinch?.((m.span - spanRef.current) / spanRef.current);
      }
      if (angleRef.current !== null) {
        let d = m.angleDeg - angleRef.current;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        gestures?.onTwist?.(d);
      }
      spanRef.current = m.span;
      angleRef.current = m.angleDeg;
      return;
    }

    if (e.pointerId !== dragPointerRef.current) return;
    orbitRef.current.dx += e.clientX - lastPointRef.current.x;
    orbitRef.current.dy += e.clientY - lastPointRef.current.y;
    lastPointRef.current = { x: e.clientX, y: e.clientY };
  };

  const endPointer = (e: ReactPointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    if (e.pointerId === dragPointerRef.current) dragPointerRef.current = null;
    const m = twoPointerMetrics();
    spanRef.current = m?.span ?? null;
    angleRef.current = m?.angleDeg ?? null;
  };

  function takeCapture() {
    if (!captureFields) return;
    const result = captureViewport(containerRef.current, { ...captureFields, backgroundColor: viewportColor });
    if (result) setPreview(result);
  }

  const clearFault = () => {
    setFault(null);
    lastFrameRef.current = performance.now();
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', touchAction: gesturesOn ? 'none' : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={endPointer}
    >
      <Canvas
        camera={{ position: CAMERA.inspectionPosition, fov: CAMERA.inspectionFov }}
        style={{ background: viewportColor }}
        onPointerMissed={onPointerMissed}
        gl={{ preserveDrawingBuffer: true }}
        onCreated={() => noteFrame()}
      >
        <color attach="background" args={[viewportColor]} />
        <StudioLights mode={studio ? 'studio' : 'light'} />
        <Suspense fallback={null}>
          <Bounds fit clip margin={CAMERA.boundsMargin}>
            <ViewResetter resetRef={resetViewRef} />
            <FocusFitter box={focusBox} />
            <Center>{children}</Center>
          </Bounds>
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          enableRotate={false}
          minPolarAngle={THREE.MathUtils.degToRad(TURNTABLE.minPolarDeg)}
          maxPolarAngle={THREE.MathUtils.degToRad(TURNTABLE.maxPolarDeg)}
          autoRotate={autoRotate}
          autoRotateSpeed={CAMERA.autoRotateSpeed}
        />
        <TurntableRig state={orbitRef} />
        <FrameHeartbeat onFrame={noteFrame} />
        {perfOn && <PerfProbe onSample={setPerf} />}
      </Canvas>

      {studio && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: theme.studio.vignette }} />}

      {active && <LoadingOverlay />}

      {fault && (
        <FaultPanel
          fault={fault}
          onRebuild={() => { clearFault(); onContextLost?.(); }}
          onDismiss={clearFault}
        />
      )}

      <div style={{
        position: 'absolute', top: 24, right: 24, display: 'flex', gap: 8, flexWrap: 'wrap',
        justifyContent: 'flex-end', maxWidth: 'calc(100% - 48px)',
      }}>
        {extraControls}
        <ChromeButton label="STUDIO" state={onOff(studio)} active={studio} onClick={() => updateSettings({ studio: !studio })} />
        {gestures && (
          <ChromeButton label="GESTURES" state={onOff(gesturesOn)} active={gesturesOn} onClick={() => setGesturesOn((v) => !v)} />
        )}
        {captureFields && <ChromeButton label="CAPTURE" onClick={takeCapture} />}
        <ChromeButton label="PERF" state={onOff(perfOn)} active={perfOn} onClick={() => setPerfOn((v) => !v)} />
        <ChromeButton label="PAN" state={onOff(panMode)} active={panMode} onClick={togglePan} />
        <ChromeButton label="RESET VIEW" onClick={resetView} />
      </div>

      {gesturesOn && <GestureHint />}

      {preview && (
        <CapturePreview
          preview={preview}
          onSave={() => { downloadCapture(preview); setPreview(null); }}
          onDiscard={() => setPreview(null)}
        />
      )}

      {perfOn && <PerfReadout perf={perf} fetchInfo={fetchInfo} loadMs={loadMs} />}
    </div>
  );
}

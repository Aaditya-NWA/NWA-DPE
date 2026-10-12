import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useBounds } from '@react-three/drei';
import * as THREE from 'three';
import Model from './Model';
import StudioLights from './StudioLights';
import { CAMERA } from '../../constants/viewer';
import type { RigSpin } from '../../types/product';

// Bounds fits once on mount; a changed margin must re-fit explicitly (TRUE SCALE toggle).
function RefitOnMarginChange({ margin }: { margin: number }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [margin, bounds]);
  return null;
}

/*
 * Presentation canvas: a turntable or leaning miniature, transparent, no chrome.
 * True relative scale = equal-size canvases with margin ∝ largestSpan / ownSpan.
 */
export default function ShowcaseCanvas({
  url,
  rigs = null,
  rotorRpm = 0,
  turntableSpeed = 0,
  tiltDeg = 0,
  margin = CAMERA.showcaseMargin,
  interactive = false,
}: {
  url: string;
  rigs?: RigSpin[] | null;
  rotorRpm?: number;
  turntableSpeed?: number;
  tiltDeg?: number;
  margin?: number;
  interactive?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: CAMERA.showcasePosition, fov: CAMERA.showcaseFov }}
      style={{ background: 'transparent', pointerEvents: interactive ? 'auto' : 'none' }}
      gl={{ alpha: true, antialias: true }}
      onCreated={({ gl }) => gl.setClearAlpha(0)}
    >
      <StudioLights mode="studio" />
      <Suspense fallback={null}>
        <Bounds fit clip margin={margin}>
          <RefitOnMarginChange margin={margin} />
          <group rotation={[THREE.MathUtils.degToRad(-tiltDeg), 0, 0]}>
            <Center>
              <Model url={url} assemblyRigs={rigs} assemblySpinRPM={rotorRpm} />
            </Center>
          </group>
        </Bounds>
      </Suspense>
      <OrbitControls
        makeDefault
        autoRotate={turntableSpeed !== 0}
        autoRotateSpeed={turntableSpeed}
        enableZoom={interactive}
        enablePan={false}
        enableRotate={interactive}
      />
    </Canvas>
  );
}

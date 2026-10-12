import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PERF_SAMPLE_MS } from '../../constants/viewer';

export interface PerfSample {
  fps: number;
  triangles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
}

export default function PerfProbe({ onSample, intervalMs = PERF_SAMPLE_MS }: {
  onSample: (sample: PerfSample) => void;
  intervalMs?: number;
}) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  const elapsed = useRef(0);

  useFrame((_state, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current * 1000 < intervalMs) return;

    onSample({
      fps: frames.current / elapsed.current,
      triangles: gl.info.render.triangles,
      drawCalls: gl.info.render.calls,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
    });

    frames.current = 0;
    elapsed.current = 0;
  });

  return null;
}

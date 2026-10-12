import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useBounds } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA, TURNTABLE } from '../../constants/viewer';

export interface OrbitState {
  dx: number;
  dy: number;
  targetAzimuth: number;
  targetPolar: number;
  currentAzimuth: number;
  currentPolar: number;
  driving: boolean;
}

const DEFAULT_VIEW_DIR = new THREE.Vector3(...CAMERA.inspectionPosition).normalize();
const MIN_POLAR = THREE.MathUtils.degToRad(TURNTABLE.minPolarDeg);
const MAX_POLAR = THREE.MathUtils.degToRad(TURNTABLE.maxPolarDeg);

type ControlsWithTarget = { target: THREE.Vector3 } | null;

// RESET VIEW: restore the angle, then let Bounds restore the distance. Never OrbitControls.reset().
export function ViewResetter({ resetRef }: { resetRef: RefObject<(() => void) | null> }) {
  const bounds = useBounds();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as ControlsWithTarget;

  useEffect(() => {
    resetRef.current = () => {
      if (controls) {
        const radius = camera.position.distanceTo(controls.target) || 1;
        camera.position.copy(controls.target).addScaledVector(DEFAULT_VIEW_DIR, radius);
        camera.lookAt(controls.target);
      }
      bounds.refresh().clip().fit();
    };
    return () => { resetRef.current = null; };
  }, [bounds, camera, controls, resetRef]);

  return null;
}

// Keyed on the box's numbers, not identity, so an equal box does not restart the flight.
export function FocusFitter({ box }: { box: THREE.Box3 | null }) {
  const bounds = useBounds();
  const key = box ? [...box.min.toArray(), ...box.max.toArray()].map((n) => n.toFixed(2)).join(',') : '';
  const boxRef = useRef(box);
  boxRef.current = box;

  useEffect(() => {
    const b = boxRef.current;
    if (b) bounds.refresh(b).clip().fit();
    else bounds.refresh().clip().fit();
  }, [key, bounds]);

  return null;
}

/*
 * Constrained turntable: the camera orbits, the model never rotates, so it stays upright.
 * Azimuth is free; polar is clamped 1° short of each pole. Drives the camera only while
 * a drag is live or easing, and follows it otherwise.
 */
export function TurntableRig({ state }: { state: RefObject<OrbitState> }) {
  const size = useThree((s) => s.size);
  const controls = useThree((s) => s.controls) as ControlsWithTarget;
  const scratch = useRef({ spherical: new THREE.Spherical(), offset: new THREE.Vector3() });

  useFrame(({ camera }, frameDelta) => {
    const s = state.current;
    if (!s || !controls) return;
    const { spherical, offset } = scratch.current;
    const target = controls.target;
    offset.copy(camera.position).sub(target);
    spherical.setFromVector3(offset);

    if (s.dx !== 0 || s.dy !== 0) {
      if (!s.driving) {
        s.targetAzimuth = spherical.theta;
        s.targetPolar = spherical.phi;
        s.currentAzimuth = spherical.theta;
        s.currentPolar = spherical.phi;
        s.driving = true;
      }
      const gain = TURNTABLE.radiansPerViewport / Math.max(1, size.height);
      s.targetAzimuth -= s.dx * gain;
      s.targetPolar = THREE.MathUtils.clamp(s.targetPolar - s.dy * gain, MIN_POLAR, MAX_POLAR);
      s.dx = 0;
      s.dy = 0;
    }

    if (!s.driving) return;

    const t = 1 - Math.exp(-TURNTABLE.smoothing * frameDelta);
    s.currentAzimuth += (s.targetAzimuth - s.currentAzimuth) * t;
    s.currentPolar += (s.targetPolar - s.currentPolar) * t;

    spherical.theta = s.currentAzimuth;
    spherical.phi = s.currentPolar;
    camera.position.copy(target).add(offset.setFromSpherical(spherical));
    camera.lookAt(target);

    if (Math.abs(s.targetAzimuth - s.currentAzimuth) < TURNTABLE.convergeEpsilon
      && Math.abs(s.targetPolar - s.currentPolar) < TURNTABLE.convergeEpsilon) {
      s.driving = false;
    }
  });

  return null;
}

export function FrameHeartbeat({ onFrame }: { onFrame: () => void }) {
  useFrame(() => onFrame());
  return null;
}

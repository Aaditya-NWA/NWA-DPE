import * as THREE from 'three';
import { PITCH_DEFAULT_MAX_DEG } from '../constants/viewer';
import { computeLocalBoundingBox, detectDominantAxis } from './geometry';

export interface SpinGroup {
  group: THREE.Group;
  axis: THREE.Vector3;
}

export interface PitchSpec {
  bladeNodeKeys: string[];
  hubTravelNodeKeys?: string[];
  hubTravel?: number;
  maxAngleDeg?: number;
}

export interface PitchRuntime {
  blades: SpinGroup[];
  hubs: { node: THREE.Object3D; basePos: THREE.Vector3 }[];
  hubAxis: THREE.Vector3;
  hubTravel: number;
  maxAngleDeg: number;
}

export interface AssemblyRig {
  spinningNodeKeys: string[];
  pitch?: PitchSpec;
}

const matchesKey = (keys: Set<string>) => (child: THREE.Object3D) =>
  keys.has(child.userData.canonicalKey) || keys.has(child.name);

// Created INSIDE rootWrapper and compensated by the subset centroid, so the
// group spins in place under the same ancestors as the fixed hub.
export function buildSpinGroup(rootWrapper: THREE.Object3D, keys: Set<string>): SpinGroup | null {
  const toSpin = rootWrapper.children.filter(matchesKey(keys));
  if (toSpin.length === 0) return null;

  const group = new THREE.Group();
  group.name = '__spinSubset';
  group.userData.isSpinSubsetGroup = true;
  rootWrapper.add(group);
  rootWrapper.updateMatrixWorld(true);

  toSpin.forEach((child) => group.attach(child));

  const box = computeLocalBoundingBox(group);
  const center = box.getCenter(new THREE.Vector3());
  group.position.copy(center);
  toSpin.forEach((child) => child.position.sub(center));

  return { group, axis: detectDominantAxis(box).axisVector.clone() };
}

// One pivot per blade, each turning about its OWN outward radial — a shared
// axis would see-saw a symmetric pair instead of pitching it.
function buildPitchGroups(spinGroup: THREE.Group, spec: PitchSpec, spinAxis: THREE.Vector3): SpinGroup[] {
  const blades = spinGroup.children.filter(matchesKey(new Set(spec.bladeNodeKeys)));
  const out: SpinGroup[] = [];

  for (const blade of blades) {
    blade.updateMatrix();
    const center = computeLocalBoundingBox(blade).getCenter(new THREE.Vector3()).applyMatrix4(blade.matrix);
    const radial = center.clone().projectOnPlane(spinAxis);
    if (radial.lengthSq() < 1e-8) {
      console.warn(
        `[Model] pitch: "${blade.userData.canonicalKey ?? blade.name}" sits on the spin axis, `
        + 'so it has no spanwise pitch axis. Skipping it.',
      );
      continue;
    }
    radial.normalize();

    const group = new THREE.Group();
    group.name = '__pitchBlade';
    group.userData.isPitchBladeGroup = true;
    spinGroup.add(group);
    spinGroup.updateMatrixWorld(true);
    group.attach(blade);
    out.push({ group, axis: radial });
  }

  if (out.length !== spec.bladeNodeKeys.length) {
    console.warn(
      `[Model] pitch: resolved ${out.length} of ${spec.bladeNodeKeys.length} authored blade key(s) `
      + 'inside the spin group. Check bladeNodeKeys against runtime canonical keys.',
    );
  }
  return out;
}

function captureHubTravel(rootWrapper: THREE.Object3D, spec: PitchSpec): PitchRuntime['hubs'] {
  const keys = new Set(spec.hubTravelNodeKeys ?? []);
  if (keys.size === 0) return [];
  return rootWrapper.children
    .filter(matchesKey(keys))
    .map((node) => ({ node, basePos: node.position.clone() }));
}

export function buildPitchRuntime(rootWrapper: THREE.Object3D, spin: SpinGroup, spec: PitchSpec): PitchRuntime {
  return {
    blades: buildPitchGroups(spin.group, spec, spin.axis),
    hubs: captureHubTravel(rootWrapper, spec),
    hubAxis: spin.axis.clone(),
    hubTravel: spec.hubTravel ?? 0,
    maxAngleDeg: spec.maxAngleDeg ?? PITCH_DEFAULT_MAX_DEG,
  };
}

// setFromAxisAngle replaces rather than accumulates; hub travel is absolute from its baseline.
export function applyPitch(runtimes: PitchRuntime[], pitchAngleDeg: number): void {
  const angleRad = THREE.MathUtils.degToRad(pitchAngleDeg);
  runtimes.forEach((rt) => {
    rt.blades.forEach(({ group, axis }) => group.quaternion.setFromAxisAngle(axis, angleRad));
    if (rt.hubs.length === 0 || rt.hubTravel === 0 || rt.maxAngleDeg === 0) return;
    const travel = rt.hubTravel * (pitchAngleDeg / rt.maxAngleDeg);
    rt.hubs.forEach(({ node, basePos }) => node.position.copy(basePos).addScaledVector(rt.hubAxis, travel));
  });
}

export function rpmToRadPerSec(rpm: number): number {
  return (rpm * Math.PI * 2) / 60;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import LabelLayer from './LabelLayer';
import type { LabelAnchor, LabelInset } from './LabelLayer';
import { computeLocalBoundingBox, detectDominantAxis } from '../../lib/geometry';
import { canonicalPartKey } from '../../lib/metadata';
import { applyPitch, buildPitchRuntime, buildSpinGroup, rpmToRadPerSec } from '../../lib/rig';
import type { AssemblyRig, PitchRuntime, PitchSpec, SpinGroup } from '../../lib/rig';
import { EXPLODE, HIGHLIGHT_INTENSITY, LABELS, XRAY } from '../../constants/viewer';
import { theme } from '../../constants/theme';
import type { ExplodeMode } from '../../types/product';

export interface AxisReadyInfo {
  axisVector: THREE.Vector3;
  maxDim: number;
}

export interface MeasuredInfo {
  size: THREE.Vector3;
  maxDim: number;
  solidCount: number;
}

interface ExplodeEntry {
  child: THREE.Object3D;
  basePos: THREE.Vector3;
  radial: THREE.Vector3;
  axial: THREE.Vector3;
}

interface ModelProps {
  url: string;
  onSelect?: (nodeName: string, canonicalKey: string) => void;
  selectedName?: string | null;
  highlightNodeKeys?: Set<string> | null;
  onNodeKeysTagged?: (keys: string[]) => void;
  onLoaded?: () => void;
  onAxisReady?: (info: AxisReadyInfo) => void;
  spinRPM?: number;
  visibleNodeNames?: Set<string> | null;
  spinningNodeNames?: Set<string> | null;
  spinRPMSubset?: number;
  assemblyRigs?: AssemblyRig[] | null;
  assemblySpinRPM?: number;
  pitchSpec?: PitchSpec | null;
  pitchAngleDeg?: number;
  explodeAmount?: number;
  explodeMode?: ExplodeMode;
  xrayAmount?: number;
  highlightRgb?: readonly [number, number, number];
  labels?: Record<string, string> | null;
  focusNodeKeys?: Set<string> | null;
  onFocusBox?: (box: THREE.Box3 | null) => void;
  labelTheme?: 'light' | 'studio';
  labelInset?: LabelInset;
  onMeasured?: (info: MeasuredInfo) => void;
}

const meshKey = (mesh: THREE.Object3D) =>
  (mesh.userData.canonicalKey ?? mesh.parent?.userData.canonicalKey) as string | undefined;

/*
 * Product-agnostic GLB engine: it knows node keys, never aircraft.
 * Effects run in declaration order and several read what an earlier one wrote —
 * keep the order: tag → highlight → x-ray → isolate → measure → spin groups →
 * explode capture/apply → label anchors → focus box → pitch.
 * Destructive effects are guarded on rootWrapper.userData (not refs) for StrictMode.
 */
export default function Model({
  url,
  onSelect,
  selectedName,
  highlightNodeKeys = null,
  onNodeKeysTagged,
  onLoaded,
  onAxisReady,
  spinRPM = 0,
  visibleNodeNames = null,
  spinningNodeNames = null,
  spinRPMSubset = 0,
  assemblyRigs = null,
  assemblySpinRPM = 0,
  pitchSpec = null,
  pitchAngleDeg = 0,
  explodeAmount = 0,
  explodeMode = 'radial',
  xrayAmount = 0,
  highlightRgb = theme.highlight.default,
  labels = null,
  labelTheme = 'light',
  labelInset = LABELS.defaultInset,
  focusNodeKeys = null,
  onFocusBox,
  onMeasured,
}: ModelProps) {
  const { scene: cachedScene } = useGLTF(url);
  const scene = useMemo(() => cachedScene.clone(true), [cachedScene]);

  // Per-mount materials: clone() shares them with the cache, and x-ray/highlight write into them.
  useMemo(() => {
    const remap = new Map<THREE.Material, THREE.Material>();
    const swap = (m: THREE.Material) => {
      let copy = remap.get(m);
      if (!copy) { copy = m.clone(); remap.set(m, copy); }
      return copy;
    };
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
    });
  }, [scene]);

  const pivotRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const spinSubsetRef = useRef<THREE.Group | null>(null);
  const axisRef = useRef(new THREE.Vector3(0, 0, 1));
  const subsetAxisRef = useRef(new THREE.Vector3(0, 0, 1));
  const pitchRuntimesRef = useRef<PitchRuntime[]>([]);
  const assemblySpinRef = useRef<SpinGroup[]>([]);
  const explodeDataRef = useRef<ExplodeEntry[] | null>(null);
  const [labelAnchors, setLabelAnchors] = useState<LabelAnchor[]>([]);

  const rootWrapper = () => groupRef.current?.children[0] ?? null;

  useEffect(() => {
    onLoaded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Index is a position in the PRISTINE children array: must run exactly once per clone.
  useEffect(() => {
    const root = rootWrapper();
    if (!root || root.userData.__canonicalKeysTagged) return;
    root.userData.__canonicalKeysTagged = true;
    const keys = root.children.map((child, i) => {
      const key = canonicalPartKey(child.name, i);
      child.userData.canonicalKey = key;
      return key;
    });
    onNodeKeysTagged?.(keys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useEffect(() => {
    groupRef.current?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (!mat.emissive) return;
      if (!mesh.userData._baseEmissive) mesh.userData._baseEmissive = mat.emissive.clone();
      const key = meshKey(mesh);
      const isSelected = highlightNodeKeys
        ? key !== undefined && highlightNodeKeys.has(key)
        : mesh.name === selectedName;
      if (isSelected) {
        mat.emissive.setRGB(highlightRgb[0], highlightRgb[1], highlightRgb[2]);
        mat.emissiveIntensity = HIGHLIGHT_INTENSITY;
      } else {
        mat.emissive.copy(mesh.userData._baseEmissive as THREE.Color);
        mat.emissiveIntensity = 0;
      }
    });
  }, [scene, selectedName, highlightNodeKeys, highlightRgb]);

  // depthWrite must drop with transparency or faded skins hide the internals.
  useEffect(() => {
    const fading = xrayAmount > 0;
    groupRef.current?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mesh.userData._baseOpacity === undefined) {
        mesh.userData._baseOpacity = mat.opacity;
        mesh.userData._baseTransparent = mat.transparent;
        mesh.userData._baseDepthWrite = mat.depthWrite;
      }
      const key = meshKey(mesh);
      const kept = Boolean(highlightNodeKeys && key !== undefined && highlightNodeKeys.has(key));
      if (!fading || kept) {
        mat.opacity = mesh.userData._baseOpacity as number;
        mat.transparent = mesh.userData._baseTransparent as boolean;
        mat.depthWrite = mesh.userData._baseDepthWrite as boolean;
      } else {
        mat.opacity = (mesh.userData._baseOpacity as number) * (1 - xrayAmount * XRAY.fadeFactor);
        mat.transparent = true;
        mat.depthWrite = false;
      }
      mat.needsUpdate = true;
    });
  }, [scene, xrayAmount, highlightNodeKeys, visibleNodeNames]);

  // Isolation REMOVES nodes: Box3/Bounds ignore `.visible`.
  useEffect(() => {
    const root = rootWrapper();
    if (!root || !visibleNodeNames) return;
    root.children
      .filter((child) => !child.userData.isSpinSubsetGroup
        && !visibleNodeNames.has(child.userData.canonicalKey)
        && !visibleNodeNames.has(child.name))
      .forEach((child) => root.remove(child));
  }, [scene, visibleNodeNames]);

  useEffect(() => {
    const root = rootWrapper();
    if (!onMeasured || !root) return;
    const size = computeLocalBoundingBox(root).getSize(new THREE.Vector3());
    onMeasured({ size, maxDim: Math.max(size.x, size.y, size.z), solidCount: root.children.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, visibleNodeNames]);

  useEffect(() => {
    const root = rootWrapper();
    if (!root || !spinningNodeNames || spinningNodeNames.size === 0) return;
    if (root.userData.__spinSubsetInitialized) return;
    root.userData.__spinSubsetInitialized = true;

    const built = buildSpinGroup(root, spinningNodeNames);
    if (!built) return;
    subsetAxisRef.current.copy(built.axis);
    spinSubsetRef.current = built.group;
    if (pitchSpec) pitchRuntimesRef.current = [buildPitchRuntime(root, built, pitchSpec)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, spinningNodeNames]);

  useEffect(() => {
    const root = rootWrapper();
    if (!root || !assemblyRigs || assemblyRigs.length === 0) return;
    if (root.userData.__assemblyRigsInitialized) return;
    root.userData.__assemblyRigsInitialized = true;

    const runtimes: PitchRuntime[] = [];
    const built = assemblyRigs.map((rig) => {
      const spin = buildSpinGroup(root, new Set(rig.spinningNodeKeys));
      if (spin && rig.pitch) runtimes.push(buildPitchRuntime(root, spin, rig.pitch));
      return spin;
    });
    assemblySpinRef.current = built.filter((b): b is SpinGroup => b !== null);
    pitchRuntimesRef.current = runtimes;

    if (assemblySpinRef.current.length !== assemblyRigs.length) {
      console.warn(
        `[Model] whole-assembly spin: only ${assemblySpinRef.current.length} of ${assemblyRigs.length} rigs `
        + 'resolved to real nodes. Check that the authored spinningNodeKeys match runtime canonical keys.',
      );
    }
  }, [scene, assemblyRigs]);

  // Must follow both spin-group effects: capturing before them left rotors 606 units adrift on reassembly.
  useEffect(() => {
    explodeDataRef.current = null;
    const root = rootWrapper();
    if (!root) return;
    const candidates = root.children.slice();
    if (candidates.length < 2) return;

    const overallBox = computeLocalBoundingBox(root);
    const overallCenter = overallBox.getCenter(new THREE.Vector3());
    const overallSize = overallBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(overallSize.x, overallSize.y, overallSize.z) || 1;
    const layerAxis = detectDominantAxis(overallBox).axisVector;
    const halfExtent = Math.max(1e-6, overallSize.dot(layerAxis) / 2);

    explodeDataRef.current = candidates.map((child) => {
      child.updateMatrix();
      const childCenter = computeLocalBoundingBox(child).getCenter(new THREE.Vector3()).applyMatrix4(child.matrix);
      const offset = childCenter.clone().sub(overallCenter);
      const radial = offset.lengthSq() < 1e-8 ? new THREE.Vector3() : offset.clone().normalize();
      radial.multiplyScalar(maxDim * EXPLODE.radialScale);
      const axial = layerAxis.clone().multiplyScalar((offset.dot(layerAxis) / halfExtent) * maxDim * EXPLODE.axialScale);
      return { child, basePos: child.position.clone(), radial, axial };
    });
  }, [scene, visibleNodeNames, spinningNodeNames, assemblyRigs]);

  useEffect(() => {
    explodeDataRef.current?.forEach(({ child, basePos, radial, axial }) => {
      child.position.copy(basePos).addScaledVector(explodeMode === 'axial' ? axial : radial, explodeAmount);
    });
  }, [explodeAmount, explodeMode, scene, visibleNodeNames, spinningNodeNames, assemblyRigs]);

  // After explode: anchors read child.position through child.matrix.
  useEffect(() => {
    if (!labels || Object.keys(labels).length === 0) {
      setLabelAnchors((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const root = rootWrapper();
    if (!root) return;
    const out: LabelAnchor[] = [];
    root.children.forEach((child) => {
      const key = child.userData.canonicalKey as string | undefined;
      const text = key ? labels[key] : undefined;
      if (!key || !text) return;
      child.updateMatrix();
      const pos = computeLocalBoundingBox(child)
        .getCenter(new THREE.Vector3())
        .applyMatrix4(child.matrix)
        .applyMatrix4(root.matrix);
      out.push({ key, text, pos });
    });
    setLabelAnchors(out);
  }, [scene, visibleNodeNames, explodeAmount, explodeMode, labels]);

  // World-space bounds for the guided tour camera; the Viewer decides what to do with them.
  useEffect(() => {
    if (!onFocusBox) return;
    if (!focusNodeKeys || focusNodeKeys.size === 0) { onFocusBox(null); return; }
    const root = rootWrapper();
    if (!root) return;
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    root.children.forEach((child) => {
      const key = child.userData.canonicalKey as string | undefined;
      if (!key || !focusNodeKeys.has(key)) return;
      const local = computeLocalBoundingBox(child);
      if (local.isEmpty()) return;
      box.union(local.applyMatrix4(child.matrixWorld));
    });
    onFocusBox(box.isEmpty() ? null : box);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, focusNodeKeys, explodeAmount, explodeMode, visibleNodeNames]);

  // Hub travel and explode both write child.position; App never enables both on one screen.
  useEffect(() => {
    if (pitchRuntimesRef.current.length > 0) applyPitch(pitchRuntimesRef.current, pitchAngleDeg);
  }, [pitchAngleDeg, scene, spinningNodeNames, assemblyRigs]);

  useFrame((_state, delta) => {
    if (!assemblySpinRPM || assemblySpinRef.current.length === 0) return;
    const step = rpmToRadPerSec(assemblySpinRPM) * delta;
    assemblySpinRef.current.forEach(({ group, axis }) => group.rotateOnAxis(axis, step));
  });

  useFrame((_state, delta) => {
    if (!spinSubsetRef.current || !spinRPMSubset) return;
    spinSubsetRef.current.rotateOnAxis(subsetAxisRef.current, rpmToRadPerSec(spinRPMSubset) * delta);
  });

  useEffect(() => {
    const root = rootWrapper();
    if (!groupRef.current || !root) return;
    const box = computeLocalBoundingBox(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const { axisVector } = detectDominantAxis(box);
    axisRef.current.copy(axisVector);
    onAxisReady?.({ axisVector: axisVector.clone(), maxDim: Math.max(size.x, size.y, size.z) || 1 });
    pivotRef.current?.position.copy(center);
    groupRef.current.position.set(-center.x, -center.y, -center.z);
    spinRef.current?.quaternion.identity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  useFrame((_state, delta) => {
    if (!spinRef.current || !spinRPM) return;
    spinRef.current.rotateOnAxis(axisRef.current, rpmToRadPerSec(spinRPM) * delta);
  });

  return (
    <group ref={pivotRef}>
      <group ref={spinRef}>
        <primitive
          ref={groupRef}
          object={scene}
          onClick={(e: ThreeEvent<MouseEvent>) => {
            e.stopPropagation();
            if ((e.object as THREE.Mesh).isMesh && onSelect) {
              onSelect(e.object.name, e.object.userData?.canonicalKey ?? e.object.name);
            }
          }}
        >
          <LabelLayer
            anchors={labelAnchors}
            selectedKeys={highlightNodeKeys}
            palette={theme.labels[labelTheme]}
            inset={labelInset}
            onPick={onSelect}
          />
        </primitive>
      </group>
    </group>
  );
}

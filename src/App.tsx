import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import Viewer from './components/engine/Viewer';
import Model from './components/engine/Model';
import type { MeasuredInfo } from './components/engine/Model';
import ViewportFrame from './components/engine/ViewportFrame';
import TopBar from './components/layout/TopBar';
import SettingsPanel from './components/layout/SettingsPanel';
import InfoPanel from './components/inspection/InfoPanel';
import SectionBrowser from './components/inspection/SectionBrowser';
import ScaleReference from './components/inspection/ScaleReference';
import ScenarioBar from './components/inspection/ScenarioBar';
import { ExplodeSlider, PitchRow, RpmRow, TelemetryDivider, TelemetryPanel, XrayRow } from './components/inspection/Telemetry';
import { ChromeButton, PrimaryButton } from './components/ui/Buttons';
import { SegmentedToggle, WhyNote } from './components/ui/Controls';
import EntryScreen from './screens/EntryScreen';
import ExpoMenuScreen from './screens/ExpoMenuScreen';
import ShowcaseScreen from './screens/ShowcaseScreen';
import FlyScreen from './screens/FlyScreen';
import CompareScreen from './screens/CompareScreen';
import FleetScreen from './screens/FleetScreen';
import SpecMatrixScreen from './screens/SpecMatrixScreen';
import AdminScreen from './screens/AdminScreen';
import { useCatalogue } from './hooks/useCatalogue';
import {
  buildMemberIndex,
  buildSectionIndex,
  reportSectionCoverage,
  resolveAssemblySelection,
  resolveMemberSelection,
  rigPartsInSection,
} from './lib/metadata';
import { readSession, signOut } from './lib/session';
import type { MockSession } from './lib/session';
import { useSettings } from './lib/settings';
import { play } from './lib/audio';
import { buildDefaultScenario, useIdleTimer, useScenarioPlayback } from './lib/scenario';
import { useValueTween } from './lib/tween';
import { useGamepad } from './lib/gamepad';
import { buildExplodeLabels, labelInsetFor } from './lib/labels';
import { clamp01, onOff } from './lib/format';
import type { AssemblyRig } from './lib/rig';
import { PAGE_SCREENS, PRODUCTS, SCREEN_DEPTH } from './constants/products';
import { EXPLODE, LABELS, PITCH_DEFAULT_MAX_DEG, RPM, TOUR_NEAR_PROGRESS } from './constants/viewer';
import { WHY_NOTES } from './constants/content';
import { theme } from './constants/theme';
import type { DetailFocus, ExplodeMode, PitchDefinition, ViewMode } from './types/product';

const ASSEMBLY_TOGGLE = [{ id: 'assembled', label: 'ASSEMBLED' }, { id: 'exploded', label: 'EXPLODED' }];

export default function App() {
  const [view, setView] = useState<ViewMode>({ screen: 'entry' });
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedCanonicalKey, setSelectedCanonicalKey] = useState<string | null>(null);
  const [rpm, setRpm] = useState(0);
  const [explodeAmount, setExplodeAmount] = useState(0);
  const [assemblyExplode, setAssemblyExplode] = useState(0);
  const [explodeMode, setExplodeMode] = useState<ExplodeMode>('radial');
  const [xray, setXray] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pitchDeg, setPitchDeg] = useState(0);
  const [session, setSession] = useState<MockSession | null>(() => readSession());
  const [spinPropellers, setSpinPropellers] = useState(false);
  const [assemblyRpm, setAssemblyRpm] = useState(RPM.assemblyDefault);

  const [settings] = useSettings();
  const studio = settings.studio;
  const metadataById = useCatalogue(PRODUCTS);

  const explodeSeconds = settings.reducedMotion ? 0 : EXPLODE.tweenSeconds;
  const detailExplodeTween = useValueTween(setExplodeAmount, explodeSeconds);
  const assemblyExplodeTween = useValueTween(setAssemblyExplode, explodeSeconds);

  const activeProduct = 'productId' in view ? PRODUCTS.find((p) => p.id === view.productId) : undefined;
  const metadata = activeProduct ? metadataById[activeProduct.id] ?? null : null;
  const parts = useMemo(() => metadata?.parts ?? {}, [metadata]);

  useEffect(() => {
    setSelectedName(null);
    setSelectedCanonicalKey(null);
  }, [activeProduct?.id]);

  const memberIndex = useMemo(() => buildMemberIndex(parts), [parts]);
  const sections = useMemo(() => metadata?.sections ?? {}, [metadata]);
  const sectionIndex = useMemo(() => buildSectionIndex(sections), [sections]);
  const hasSections = Object.keys(sections).length > 0;

  const handleNodeKeysTagged = useCallback(
    (keys: string[]) => reportSectionCoverage(keys, sections, parts),
    [sections, parts],
  );

  const partKey = selectedCanonicalKey ? (memberIndex[selectedCanonicalKey] ?? selectedCanonicalKey) : null;
  const partInfo = partKey ? parts[partKey] : undefined;

  const assemblySelection = useMemo(() => {
    if (!hasSections || !selectedCanonicalKey) return null;
    return resolveAssemblySelection(selectedCanonicalKey, sectionIndex, memberIndex);
  }, [hasSections, selectedCanonicalKey, sectionIndex, memberIndex]);
  const selectedSection = assemblySelection?.level === 'section' ? sections[assemblySelection.sectionId] : undefined;

  const assemblyFocus: DetailFocus | null = assemblySelection
    ? (assemblySelection.level === 'section'
      ? { kind: 'section', sectionId: assemblySelection.sectionId }
      : { kind: 'component', componentKey: assemblySelection.partKey })
    : (partKey ? { kind: 'component', componentKey: partKey } : null);

  // ---- detail screens -------------------------------------------------
  const focus = view.screen === 'in-depth' || view.screen === 'try-rpm' ? view.focus : null;
  // A primitive, so the visible set only changes identity when the isolated thing does.
  const focusKey = focus ? (focus.kind === 'section' ? focus.sectionId : focus.componentKey) : null;
  // The RPM screen isolates the rig component, never the whole section.
  const isolatedKey = view.screen === 'try-rpm' ? view.componentKey : focusKey;
  const isolatedIsSection = view.screen === 'in-depth' && focus?.kind === 'section';

  const detailVisibleSet = useMemo(() => {
    if (!isolatedKey) return null;
    if (isolatedIsSection) return new Set(sections[isolatedKey]?.memberNodeKeys ?? [isolatedKey]);
    return new Set<string>(parts[isolatedKey]?.memberNodeKeys ?? [isolatedKey]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isolatedKey, isolatedIsSection, metadata]);

  const explodeEligible = (detailVisibleSet?.size ?? 0) > 1;

  const memberKey = view.screen === 'in-depth' && selectedCanonicalKey
    ? resolveMemberSelection(selectedCanonicalKey, memberIndex)
    : null;
  const memberInfo = memberKey ? parts[memberKey] : undefined;

  const sectionRigKey = useMemo(() => {
    if (view.screen !== 'in-depth' || focus?.kind !== 'section') return null;
    const rigs = rigPartsInSection(focus.sectionId, sections, parts);
    return rigs.length === 1 ? rigs[0] : null;
  }, [view.screen, focus, sections, parts]);
  const memberRigKey = memberInfo?.rig ? memberKey : null;
  const componentRigKey = view.screen === 'in-depth' && focus?.kind === 'component' && parts[focus.componentKey]?.rig
    ? focus.componentKey
    : null;
  const rpmTargetKey = memberRigKey ?? componentRigKey ?? sectionRigKey;

  const spinningSet = useMemo(() => {
    if (view.screen !== 'try-rpm') return null;
    const rig = parts[view.componentKey]?.rig;
    return rig ? new Set(rig.spinningNodeKeys) : null;
  }, [view, parts]);

  // ---- guided tour ----------------------------------------------------
  // Hub travel and explode both write child.position, so pitch-capable products do not explode here.
  const assemblyCanExplode = useMemo(() => !Object.values(parts).some((p) => p.rig?.pitch), [parts]);

  const scenario = useMemo(() => {
    if (!activeProduct || !hasSections) return null;
    return metadata?.scenarios?.[0] ?? buildDefaultScenario(activeProduct.label, sections, { canExplode: assemblyCanExplode });
  }, [activeProduct, metadata, sections, hasSections, assemblyCanExplode]);

  const [playback, playbackControls] = useScenarioPlayback(scenario);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  // Hand the tour's explode value to manual state and ease it home, so stopping never snaps.
  const stopTour = useCallback(() => {
    const from = playbackRef.current.explode;
    playbackControls.stop();
    if (from > 0.01) {
      setAssemblyExplode(from);
      assemblyExplodeTween.run(from, 0);
    }
  }, [playbackControls, assemblyExplodeTween]);

  useIdleTimer(
    settings.idleDemo && !settings.reducedMotion && view.screen === 'assembly' && !playback.active && Boolean(scenario),
    settings.idleDemoDelaySec,
    playbackControls.start,
  );

  useEffect(() => {
    if (!playback.active) return;
    const onDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.('[data-scenario-bar]')) return;
      stopTour();
    };
    window.addEventListener('pointerdown', onDown, { capture: true });
    return () => window.removeEventListener('pointerdown', onDown, { capture: true });
  }, [playback.active, stopTour]);

  useEffect(() => {
    if (view.screen !== 'assembly' && playback.active) playbackControls.stop();
  }, [view.screen, playback.active, playbackControls]);

  const playbackSection = playback.active ? playback.sectionId : null;

  // Move in for the first 70% of each section step, pull back for the rest. Keyed on a boolean, not progress.
  const tourNear = playback.active && playback.progress < TOUR_NEAR_PROGRESS;
  const tourFocusKeys = useMemo(() => {
    if (!playbackSection || !tourNear) return null;
    const keys = sections[playbackSection]?.memberNodeKeys;
    return keys && keys.length > 0 ? new Set(keys) : null;
  }, [playbackSection, tourNear, sections]);
  const [tourFocusBox, setTourFocusBox] = useState<THREE.Box3 | null>(null);
  const handleFocusBox = useCallback((box: THREE.Box3 | null) => setTourFocusBox(box), []);

  const highlightNodeKeys = useMemo(() => {
    if (view.screen === 'assembly') {
      if (playbackSection) return new Set(sections[playbackSection]?.memberNodeKeys ?? []);
      if (selectedSection) return new Set(selectedSection.memberNodeKeys);
      if (hasSections && partKey) return new Set(parts[partKey]?.memberNodeKeys ?? [partKey]);
      return null;
    }
    if (view.screen === 'in-depth' && memberKey) return new Set(memberInfo?.memberNodeKeys ?? [memberKey]);
    return null;
  }, [view.screen, playbackSection, sections, selectedSection, hasSections, partKey, memberKey, memberInfo, parts]);

  const detailInfo = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === 'section') {
      const section = sections[focus.sectionId];
      if (!section) return null;
      return {
        title: section.displayName,
        description: `${section.description} Tap any solid to inspect it.`,
        tag: `SECTION · ${section.memberNodeKeys.length} SOLIDS`,
      };
    }
    const part = parts[focus.componentKey];
    return {
      title: part?.displayName ?? focus.componentKey,
      description: part?.description ?? WHY_NOTES.noMetadataComponent,
      tag: 'COMPONENT',
    };
  }, [focus, sections, parts]);

  const detailLabel = focus
    ? (focus.kind === 'section' ? sections[focus.sectionId]?.displayName : parts[focus.componentKey]?.displayName)
    : undefined;

  function clearSelection() {
    setSelectedName(null);
    setSelectedCanonicalKey(null);
  }

  // Every screen change resets motion, explode (and its tweens), pitch, x-ray, measurement and selection.
  // Measurement resets HERE, not in an effect: a cached GLB measures in the same commit and a parent effect would wipe it.
  function exitTo(target: ViewMode) {
    setRpm(0);
    detailExplodeTween.stop();
    assemblyExplodeTween.stop();
    setExplodeAmount(0);
    setAssemblyExplode(0);
    setPitchDeg(0);
    setXray(0);
    setMeasured(null);
    clearSelection();
    const going = SCREEN_DEPTH[target.screen] - SCREEN_DEPTH[view.screen];
    play(going > 0 ? 'enter' : going < 0 ? 'back' : 'tap');
    setView(target);
  }

  function handleSelect(name: string, canonicalKey: string) {
    setSelectedName(name);
    setSelectedCanonicalKey(canonicalKey);
    play('select');
  }

  // ---- measurement for the scale reference ----------------------------
  const [measured, setMeasured] = useState<MeasuredInfo | null>(null);
  // Whole-product longest dimension, recorded on the assembly screen only: it is the unit→metre conversion.
  const [productMaxDimById, setProductMaxDimById] = useState<Record<string, number>>({});
  const handleMeasured = useCallback((info: MeasuredInfo) => setMeasured(info), []);
  const handleAssemblyMeasured = useCallback((info: MeasuredInfo) => {
    setMeasured(info);
    const id = 'productId' in view ? view.productId : null;
    if (id && info.maxDim > 0) setProductMaxDimById((prev) => (prev[id] === info.maxDim ? prev : { ...prev, [id]: info.maxDim }));
  }, [view]);

  const assemblyExplodeAmount = assemblyCanExplode ? (playback.active ? playback.explode : assemblyExplode) : 0;

  const explodeLabels = useMemo(() => {
    if (!settings.explodeLabels) return null;
    const onAssembly = view.screen === 'assembly';
    if (view.screen !== 'in-depth' && !onAssembly) return null;
    const amount = onAssembly ? assemblyExplodeAmount : explodeAmount;
    if (amount < LABELS.explodeThreshold) return null;
    const visible = onAssembly ? null : detailVisibleSet;
    if (!onAssembly && !visible) return null;
    return buildExplodeLabels(visible ?? Object.keys(memberIndex), visible, memberIndex, metadata?.parts);
  }, [view.screen, explodeAmount, assemblyExplodeAmount, detailVisibleSet, memberIndex, metadata, settings.explodeLabels]);

  // ---- whole-assembly spin & pitch ------------------------------------
  const assemblyHasRigs = useMemo(() => Object.values(parts).some((p) => p.rig), [parts]);
  // Always passed when rigs exist: pitch groups are built inside the spin groups.
  const assemblyRigs = useMemo<AssemblyRig[] | null>(() => {
    if (view.screen !== 'assembly') return null;
    const rigs = Object.values(parts)
      .filter((p) => p.rig)
      .map((p) => ({ spinningNodeKeys: p.rig!.spinningNodeKeys, pitch: p.rig!.pitch }));
    return rigs.length > 0 ? rigs : null;
  }, [view.screen, parts]);

  // Rotors stop while the aircraft is apart, whichever route exploded it.
  const assemblySpinning = (playback.active ? (playback.spin && !settings.reducedMotion) : spinPropellers)
    && assemblyExplodeAmount < EXPLODE.spinStopThreshold;
  const spinLocked = assemblyExplodeAmount >= EXPLODE.spinStopThreshold;

  const activePitchSpecs = useMemo<PitchDefinition[]>(() => {
    if (view.screen === 'assembly') {
      return Object.values(parts).map((p) => p.rig?.pitch).filter((s): s is PitchDefinition => Boolean(s));
    }
    if (view.screen === 'try-rpm') {
      const spec = parts[view.componentKey]?.rig?.pitch;
      return spec ? [spec] : [];
    }
    return [];
  }, [view, parts]);

  const pitchMaxDeg = activePitchSpecs.length
    ? Math.max(...activePitchSpecs.map((s) => s.maxAngleDeg ?? PITCH_DEFAULT_MAX_DEG))
    : PITCH_DEFAULT_MAX_DEG;

  const assemblyPanelsUp = (activePitchSpecs.length > 0 || hasSections) && !playback.active;
  const assemblyInfoUp = Boolean(selectedName && assemblyFocus) && !playback.active;
  const labelInset = useMemo(() => (
    view.screen === 'assembly'
      ? labelInsetFor(assemblyPanelsUp, assemblyInfoUp)
      : labelInsetFor(explodeEligible, true)
  ), [view.screen, assemblyPanelsUp, assemblyInfoUp, explodeEligible]);

  const highlightRgb = settings.colorblindSafe ? theme.highlight.colorblindSafe : theme.highlight.default;
  const labelTheme = studio ? 'studio' : 'light';

  // useGLTF caches the REJECTED promise: evict it before remounting, or retry re-throws.
  const [retryNonce, setRetryNonce] = useState(0);
  function retryModel() {
    if (activeProduct) useGLTF.clear(activeProduct.glbUrl);
    setRetryNonce((n) => n + 1);
  }
  const rebuildViewport = useCallback(() => setRetryNonce((n) => n + 1), []);

  // ---- hardware control panel -----------------------------------------
  const sectionIds = useMemo(() => Object.keys(sections), [sections]);
  const viewRef = useRef(view);
  viewRef.current = view;
  const activeSectionId = assemblySelection?.level === 'section' ? assemblySelection.sectionId : null;

  const stepSection = useCallback((delta: number) => {
    if (sectionIds.length === 0) return;
    const current = activeSectionId ? sectionIds.indexOf(activeSectionId) : (delta > 0 ? -1 : 0);
    const id = sectionIds[(current + delta + sectionIds.length) % sectionIds.length];
    const first = sections[id]?.memberNodeKeys[0];
    if (first) handleSelect(first, first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIds, sections, activeSectionId]);

  const { connected: gamepadId } = useGamepad(true, {
    onPress: (action) => {
      const v = viewRef.current;
      switch (action) {
        case 'next':
        case 'dpadRight':
          if (v.screen === 'assembly') stepSection(1);
          break;
        case 'prev':
        case 'dpadLeft':
          if (v.screen === 'assembly') stepSection(-1);
          break;
        case 'confirm':
          if (v.screen === 'assembly' && assemblyFocus && activeProduct) {
            exitTo({ screen: 'in-depth', productId: activeProduct.id, focus: assemblyFocus });
          }
          break;
        case 'back':
          if (v.screen === 'try-rpm') exitTo({ screen: 'in-depth', productId: v.productId, focus: v.focus });
          else if (v.screen === 'in-depth') exitTo({ screen: 'assembly', productId: v.productId });
          else if (v.screen === 'assembly') exitTo({ screen: 'menu' });
          break;
        case 'toggle':
          if (v.screen === 'assembly' && assemblyHasRigs) setSpinPropellers((s) => !s);
          break;
        case 'demo':
          if (v.screen === 'assembly' && scenario) {
            if (playback.active) stopTour();
            else playbackControls.start();
          }
          break;
        default:
          break;
      }
    },
    onDial: (value) => {
      const v = viewRef.current;
      const level = clamp01((-value + 1) / 2);
      if (v.screen === 'try-rpm') setRpm(Math.round(level * RPM.max));
      else if (v.screen === 'assembly' || v.screen === 'in-depth') setXray(level);
    },
  });

  const isPageScreen = PAGE_SCREENS.has(view.screen);
  const productMaxDim = activeProduct ? productMaxDimById[activeProduct.id] ?? null : null;
  const riggedSectionIds = useMemo(
    () => new Set(Object.keys(sections).filter((id) => rigPartsInSection(id, sections, parts).length > 0)),
    [sections, parts],
  );

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: theme.font.ui, background: theme.gradient.page, color: theme.color.text }}>
      <TopBar
        view={view}
        onExit={exitTo}
        productLabel={activeProduct?.label}
        detailLabel={detailLabel}
        sessionEmail={session?.email ?? null}
        onSignOut={() => { signOut(); setSession(null); }}
        onOpenSettings={() => setSettingsOpen(true)}
        gamepadId={gamepadId}
      />

      <main style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        userSelect: isPageScreen ? undefined : 'none',
        WebkitUserSelect: isPageScreen ? undefined : 'none',
        margin: isPageScreen ? 0 : '16px 20px 20px',
        borderRadius: isPageScreen ? 0 : theme.radius.xl,
        background: isPageScreen ? 'transparent' : (studio ? theme.studio.viewport : theme.color.viewport),
        border: isPageScreen ? 'none' : `1px solid ${theme.color.viewportBorder}`,
        boxShadow: isPageScreen ? 'none' : theme.shadow.panel,
      }}>
        {view.screen === 'entry' && (
          <EntryScreen
            products={PRODUCTS}
            metadataById={metadataById}
            onSelect={(door) => exitTo(door === 'expos' ? { screen: 'menu' } : { screen: 'showcase' })}
          />
        )}

        {view.screen === 'menu' && (
          <ExpoMenuScreen
            products={PRODUCTS}
            metadataById={metadataById}
            onSelect={(id) => exitTo({ screen: 'assembly', productId: id })}
            onNavigate={exitTo}
          />
        )}

        {view.screen === 'specs' && (
          <SpecMatrixScreen
            products={PRODUCTS}
            metadataById={metadataById}
            onOpen={(id) => exitTo({ screen: 'assembly', productId: id })}
            onCompare={(leftId, rightId) => exitTo({ screen: 'compare', leftId, rightId })}
          />
        )}

        {view.screen === 'fleet' && (
          <FleetScreen
            products={PRODUCTS}
            metadataById={metadataById}
            onOpen={(id) => exitTo({ screen: 'assembly', productId: id })}
            onCompare={(leftId, rightId) => exitTo({ screen: 'compare', leftId, rightId })}
          />
        )}

        {view.screen === 'compare' && (
          <CompareScreen
            products={PRODUCTS}
            metadataById={metadataById}
            leftId={view.leftId}
            rightId={view.rightId}
            onChangeSides={(leftId, rightId) => setView({ screen: 'compare', leftId, rightId })}
            onOpen={(id) => exitTo({ screen: 'assembly', productId: id })}
          />
        )}

        {view.screen === 'admin' && (
          <AdminScreen products={PRODUCTS} metadataById={metadataById} onOpen={(id) => exitTo({ screen: 'assembly', productId: id })} />
        )}

        {view.screen === 'showcase' && (
          <ShowcaseScreen products={PRODUCTS} metadataById={metadataById} onFly={(id) => exitTo({ screen: 'fly', productId: id })} />
        )}

        {view.screen === 'fly' && activeProduct && metadata?.website && (
          <FlyScreen
            product={activeProduct}
            metadata={metadata}
            session={session}
            onSignedIn={setSession}
            onExit={() => exitTo({ screen: 'showcase' })}
          />
        )}

        {view.screen === 'assembly' && activeProduct && (
          <ViewportFrame resetKey={`assembly:${activeProduct.id}:${retryNonce}`} onRetry={retryModel}>
            <Viewer
              onPointerMissed={clearSelection}
              autoRotate={playback.active && playback.autoOrbit && !settings.reducedMotion}
              onContextLost={rebuildViewport}
              focusBox={tourFocusBox}
              captureFields={{
                productLabel: activeProduct.label,
                selectionLabel: selectedSection?.displayName ?? partInfo?.displayName,
                screenLabel: 'ASSEMBLY',
              }}
              gestures={{
                onPinch: (d) => {
                  if (assemblyCanExplode) {
                    assemblyExplodeTween.stop();
                    setAssemblyExplode((v) => clamp01(v + d));
                  } else {
                    setXray((x) => clamp01(x + d));
                  }
                },
                onTwist: (d) => { if (assemblyHasRigs) setSpinPropellers(Math.abs(d) > 1.5); },
              }}
              extraControls={(
                <>
                  {assemblyCanExplode && !playback.active && (
                    <SegmentedToggle
                      value={assemblyExplode >= EXPLODE.toggleThreshold ? 'exploded' : 'assembled'}
                      onChange={(id) => assemblyExplodeTween.run(assemblyExplode, id === 'exploded' ? 1 : 0)}
                      options={ASSEMBLY_TOGGLE}
                    />
                  )}
                  {scenario && (
                    <ChromeButton
                      label="TOUR"
                      state={onOff(playback.active)}
                      active={playback.active}
                      onClick={() => (playback.active ? stopTour() : playbackControls.start())}
                    />
                  )}
                  {assemblyHasRigs && (
                    <ChromeButton
                      label="SPIN PROPS"
                      state={onOff(spinPropellers)}
                      active={spinPropellers}
                      disabled={spinLocked}
                      onClick={() => setSpinPropellers((v) => !v)}
                      style={{ opacity: spinLocked ? 0.45 : 1, cursor: spinLocked ? 'default' : 'pointer' }}
                    />
                  )}
                </>
              )}
            >
              <Model
                url={activeProduct.glbUrl}
                selectedName={selectedName}
                highlightNodeKeys={highlightNodeKeys}
                highlightRgb={highlightRgb}
                onSelect={handleSelect}
                onNodeKeysTagged={handleNodeKeysTagged}
                onMeasured={handleAssemblyMeasured}
                assemblyRigs={assemblyRigs}
                assemblySpinRPM={assemblySpinning ? assemblyRpm : 0}
                pitchAngleDeg={pitchDeg}
                xrayAmount={xray}
                explodeAmount={assemblyExplodeAmount}
                explodeMode={explodeMode}
                labels={explodeLabels}
                labelTheme={labelTheme}
                labelInset={labelInset}
                focusNodeKeys={tourFocusKeys}
                onFocusBox={handleFocusBox}
              />
            </Viewer>

            <ScenarioBar state={playback} controls={playbackControls} title={scenario?.title ?? 'Guided tour'} />

            {assemblyPanelsUp && (
              <TelemetryPanel>
                {assemblyCanExplode && (
                  <>
                    <ExplodeSlider
                      value={assemblyExplode}
                      onChange={(v) => { assemblyExplodeTween.stop(); setAssemblyExplode(v); }}
                      mode={explodeMode}
                      onModeChange={setExplodeMode}
                    />
                    <TelemetryDivider />
                  </>
                )}
                <XrayRow value={xray} onChange={setXray} />
                {assemblyHasRigs && spinPropellers && (
                  <>
                    <TelemetryDivider />
                    <RpmRow value={assemblyRpm} onChange={setAssemblyRpm} />
                  </>
                )}
                {activePitchSpecs.length > 0 && (
                  <>
                    <TelemetryDivider />
                    <PitchRow value={pitchDeg} max={pitchMaxDeg} onChange={setPitchDeg} caption={WHY_NOTES.pitchAssembly} />
                  </>
                )}
              </TelemetryPanel>
            )}

            {!playback.active && (
              <SectionBrowser
                sections={sections}
                activeSectionId={activeSectionId}
                riggedSectionIds={riggedSectionIds}
                onPick={(_sectionId, firstMemberKey) => handleSelect(firstMemberKey, firstMemberKey)}
              />
            )}

            {!playback.active && !selectedName && (
              <ScaleReference
                sizeUnits={measured?.size ?? null}
                productMaxDimUnits={productMaxDim}
                physical={metadata?.physical}
                subjectLabel={activeProduct.label}
              />
            )}

            {assemblyInfoUp && assemblyFocus && (
              <InfoPanel
                title={selectedSection?.displayName ?? partInfo?.displayName ?? selectedName ?? ''}
                description={selectedSection?.description ?? partInfo?.description ?? WHY_NOTES.noMetadataPart}
                tag={selectedSection ? `${selectedSection.memberNodeKeys.length} SOLIDS` : (hasSections ? 'UNSECTIONED' : undefined)}
                specs={partInfo?.specs}
                onInDepth={() => exitTo({ screen: 'in-depth', productId: activeProduct.id, focus: assemblyFocus })}
              >
                {selectedSection?.derivedFrom && (
                  <WhyNote label="WHY THESE SOLIDS?">
                    {selectedSection.derivedFrom} {WHY_NOTES.sectionSuffix}
                  </WhyNote>
                )}
              </InfoPanel>
            )}
          </ViewportFrame>
        )}

        {view.screen === 'in-depth' && activeProduct && focus && (
          <ViewportFrame resetKey={`in-depth:${activeProduct.id}:${focusKey}:${retryNonce}`} onRetry={retryModel}>
            <Viewer
              onPointerMissed={clearSelection}
              onContextLost={rebuildViewport}
              captureFields={{
                productLabel: activeProduct.label,
                selectionLabel: memberInfo?.displayName ?? detailLabel,
                screenLabel: 'DETAILED VIEW',
              }}
              gestures={{
                onPinch: (d) => {
                  if (!explodeEligible) return;
                  detailExplodeTween.stop();
                  setExplodeAmount((v) => clamp01(v + d));
                },
                onTwist: (d) => setXray((x) => clamp01(x + d / 180)),
              }}
              extraControls={explodeEligible && (
                <SegmentedToggle
                  value={explodeAmount >= EXPLODE.toggleThreshold ? 'exploded' : 'assembled'}
                  onChange={(id) => detailExplodeTween.run(explodeAmount, id === 'exploded' ? 1 : 0)}
                  options={ASSEMBLY_TOGGLE}
                />
              )}
            >
              <Model
                url={activeProduct.glbUrl}
                visibleNodeNames={detailVisibleSet}
                explodeAmount={explodeAmount}
                explodeMode={explodeMode}
                selectedName={selectedName}
                highlightNodeKeys={highlightNodeKeys}
                highlightRgb={highlightRgb}
                onSelect={handleSelect}
                onMeasured={handleMeasured}
                xrayAmount={xray}
                labels={explodeLabels}
                labelTheme={labelTheme}
                labelInset={labelInset}
              />
            </Viewer>

            {explodeEligible && (
              <TelemetryPanel>
                <ExplodeSlider
                  value={explodeAmount}
                  onChange={(v) => { detailExplodeTween.stop(); setExplodeAmount(v); }}
                  mode={explodeMode}
                  onModeChange={setExplodeMode}
                />
                <TelemetryDivider />
                <XrayRow value={xray} onChange={setXray} />
              </TelemetryPanel>
            )}

            {!selectedName && (
              <ScaleReference
                sizeUnits={measured?.size ?? null}
                productMaxDimUnits={productMaxDim}
                physical={metadata?.physical}
                subjectLabel={detailLabel ?? activeProduct.label}
              />
            )}

            {memberKey ? (
              <InfoPanel
                title={memberInfo?.displayName ?? selectedName ?? memberKey}
                description={memberInfo?.description ?? WHY_NOTES.noMetadataSolid}
                tag="COMPONENT"
                specs={memberInfo?.specs}
              >
                {memberInfo?.rig && (
                  <WhyNote label="WHY CAN THIS SPIN?">
                    {WHY_NOTES.rigIntro}
                    {memberInfo.rig.pitch
                      ? ` Its blades are separate solids too (${memberInfo.rig.pitch.derivedFrom ?? 'measured offline'}), which is what makes a rigid blade-pitch change possible.`
                      : WHY_NOTES.rigFused}
                  </WhyNote>
                )}
              </InfoPanel>
            ) : (
              detailInfo && (
                <InfoPanel title={detailInfo.title} description={detailInfo.description} tag={detailInfo.tag}>
                  {focus.kind === 'section' && sections[focus.sectionId]?.derivedFrom && (
                    <WhyNote label="WHY THESE SOLIDS?">{sections[focus.sectionId].derivedFrom}</WhyNote>
                  )}
                </InfoPanel>
              )
            )}

            {rpmTargetKey && (
              <PrimaryButton
                style={{ position: 'absolute', bottom: 24, left: 24, boxShadow: theme.shadow.accent }}
                onClick={() => exitTo({ screen: 'try-rpm', productId: activeProduct.id, focus, componentKey: rpmTargetKey })}
              >
                RPM CONTROL →
              </PrimaryButton>
            )}
          </ViewportFrame>
        )}

        {view.screen === 'try-rpm' && activeProduct && (
          <ViewportFrame resetKey={`try-rpm:${activeProduct.id}:${view.componentKey}:${retryNonce}`} onRetry={retryModel}>
            <Viewer
              onContextLost={rebuildViewport}
              captureFields={{
                productLabel: activeProduct.label,
                selectionLabel: parts[view.componentKey]?.displayName,
                screenLabel: 'RPM CONTROL',
              }}
              gestures={{ onTwist: (d) => setRpm((r) => Math.max(0, Math.min(RPM.max, r + d))) }}
            >
              <Model
                url={activeProduct.glbUrl}
                visibleNodeNames={detailVisibleSet}
                spinningNodeNames={spinningSet}
                spinRPMSubset={rpm}
                pitchSpec={activePitchSpecs[0] ?? null}
                pitchAngleDeg={pitchDeg}
                highlightRgb={highlightRgb}
              />
            </Viewer>
            <TelemetryPanel>
              <RpmRow value={rpm} onChange={setRpm} />
              {activePitchSpecs.length > 0 && (
                <>
                  <TelemetryDivider />
                  <PitchRow value={pitchDeg} max={pitchMaxDeg} onChange={setPitchDeg} caption={WHY_NOTES.pitchRpm} />
                </>
              )}
            </TelemetryPanel>
          </ViewportFrame>
        )}
      </main>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

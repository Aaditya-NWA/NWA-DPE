import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import ShowcaseCanvas from '../components/engine/ShowcaseCanvas';
import { ChromeButton, GhostButton } from '../components/ui/Buttons';
import { ProvenanceBadge } from '../components/ui/Controls';
import { DotGrid, SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import { theme } from '../constants/theme';
import { SHOWCASE } from '../constants/viewer';
import { cardStyle, eyebrowStyle, microLabelStyle, monoStyle } from '../styles/primitives';
import { useSettings } from '../lib/settings';
import { onOff } from '../lib/format';
import { rigSpinsOf } from '../lib/metadata';
import { summariseProduct } from '../lib/catalogue';
import type { ProductSummary } from '../lib/catalogue';
import type { ProductConfig, ProductMetadataFile, Provenance, RigSpin } from '../types/product';

function stepperStyle(enabled: boolean): CSSProperties {
  return {
    minWidth: theme.touchTarget, minHeight: theme.touchTarget, fontSize: 20, lineHeight: 1,
    color: enabled ? theme.color.accentBright : theme.color.textDim,
    background: theme.color.surface, border: theme.hairline, borderRadius: theme.radius.md,
    cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5,
  };
}

function Total({ label, value, provenance }: { label: string; value: string; provenance: Provenance }) {
  return (
    <div>
      <div style={{ ...monoStyle, fontSize: 26, fontWeight: 600, color: theme.color.accentBright, lineHeight: 1 }}>{value}</div>
      <div style={{ ...microLabelStyle, fontSize: 10, margin: '8px 0 6px' }}>{label}</div>
      <ProvenanceBadge provenance={provenance} />
    </div>
  );
}

// Tap to add, not drag: works on touch, with hardware buttons and without a drop zone.
function FleetBuilder({ summaries }: { summaries: ProductSummary[] }) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const adjust = (id: string, delta: number) =>
    setCounts((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const out = { ...prev };
      if (next === 0) delete out[id];
      else out[id] = next;
      return out;
    });

  const chosen = summaries.filter((s) => (counts[s.product.id] ?? 0) > 0);
  const totalAircraft = chosen.reduce((n, s) => n + counts[s.product.id], 0);
  const totalRotors = chosen.reduce((n, s) => n + s.rigCount * counts[s.product.id], 0);
  const largestSpan = chosen.reduce((m, s) => Math.max(m, s.spanM ?? 0), 0);
  const mtowLow = chosen.reduce((n, s) => n + (s.mtowRange?.min ?? 0) * counts[s.product.id], 0);
  const mtowHigh = chosen.reduce((n, s) => n + (s.mtowRange?.max ?? 0) * counts[s.product.id], 0);

  return (
    <section style={{ ...cardStyle(), marginTop: 40, padding: '28px 28px', background: theme.color.surface }}>
      <div style={{ ...eyebrowStyle, marginBottom: 10 }}>Build a fleet</div>
      <p style={{ margin: '0 0 22px', fontSize: 14, lineHeight: 1.65, color: theme.color.textSub, maxWidth: 680 }}>
        Put a combination together and see what it adds up to. Nothing is sent anywhere — this is a summary on the
        screen for the conversation you are having in front of it.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {summaries.map((s) => {
          const n = counts[s.product.id] ?? 0;
          return (
            <div key={s.product.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', borderRadius: theme.radius.md,
              background: n > 0 ? theme.color.accentGlow : theme.color.card,
              border: `1px solid ${n > 0 ? theme.color.accentLine : theme.color.border}`,
            }}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14.5, fontWeight: n > 0 ? 600 : 400, color: theme.color.text }}>{s.product.label}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: theme.color.textMuted, letterSpacing: '0.08em' }}>
                  {s.rigCount} ROTOR{s.rigCount === 1 ? '' : 'S'}
                  {s.spanM != null && ` · ${s.spanM.toFixed(2)} m`}
                  {s.mtowRange && ` · ${s.mtowRange.min}–${s.mtowRange.max} kg`}
                </span>
              </span>
              <button onClick={() => adjust(s.product.id, -1)} disabled={n === 0} aria-label={`Remove one ${s.product.label}`} style={stepperStyle(n > 0)}>−</button>
              <span style={{ ...monoStyle, fontSize: 18, minWidth: 30, textAlign: 'center', color: n > 0 ? theme.color.accentBright : theme.color.textMuted }}>{n}</span>
              <button onClick={() => adjust(s.product.id, 1)} aria-label={`Add one ${s.product.label}`} style={stepperStyle(true)}>+</button>
            </div>
          );
        })}
      </div>

      {totalAircraft === 0 ? (
        <div style={{ fontSize: 13, color: theme.color.textMuted }}>Add an aircraft to see the totals.</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'flex-start', paddingTop: 20, borderTop: theme.hairline }}>
          <Total label="Aircraft" value={String(totalAircraft)} provenance="measured" />
          <Total label="Rotor rigs" value={String(totalRotors)} provenance="measured" />
          <Total label="Largest span" value={largestSpan > 0 ? `${largestSpan.toFixed(2)} m` : '—'} provenance="measured" />
          <Total label="Combined MTOW" value={mtowHigh > 0 ? `${mtowLow.toFixed(1)}–${mtowHigh.toFixed(1)} kg` : '—'} provenance="placeholder" />
          <GhostButton style={{ marginLeft: 'auto' }} onClick={() => setCounts({})}>Clear fleet</GhostButton>
        </div>
      )}
    </section>
  );
}

function FleetCell({ summary, rigs, margin, spin, turntable, onOpen }: {
  summary: ProductSummary;
  rigs: RigSpin[] | null;
  margin: number;
  spin: boolean;
  turntable: number;
  onOpen: () => void;
}) {
  return (
    <div style={{ ...cardStyle(), flex: '1 1 260px', minWidth: 240, display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'relative', height: 320, background: theme.gradient.cardStage, borderBottom: theme.hairline }}>
        <DotGrid />
        <ShowcaseCanvas
          url={summary.product.glbUrl}
          rigs={rigs}
          rotorRpm={spin ? SHOWCASE.spinRpm : 0}
          turntableSpeed={turntable}
          margin={margin}
          interactive
        />
      </div>
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: theme.color.text }}>{summary.product.label}</div>
        <div style={{ ...monoStyle, fontSize: 11.5, color: theme.color.accentBright }}>
          {summary.spanM ? `${summary.spanM.toFixed(2)} m SPAN` : 'SPAN NOT PUBLISHED'}
        </div>
        <div style={{ fontSize: 12.5, color: theme.color.textSub, lineHeight: 1.5 }}>{summary.product.kicker}</div>
        <GhostButton onClick={onOpen} style={{ marginTop: 'auto', width: '100%' }}>Open viewer</GhostButton>
      </div>
    </div>
  );
}

// True scale is off by default so every aircraft reads; it is one tap away and needs every span.
export default function FleetScreen({ products, metadataById, onOpen, onCompare }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  onOpen: (productId: string) => void;
  onCompare: (leftId: string, rightId: string) => void;
}) {
  const [settings] = useSettings();
  const [trueScale, setTrueScale] = useState(false);
  const [spin, setSpin] = useState(false);

  const summaries = useMemo(
    () => products.map((p) => summariseProduct(p, metadataById[p.id] ?? null)),
    [products, metadataById],
  );
  const rigsById = useMemo(
    () => Object.fromEntries(summaries.map((s) => [s.product.id, rigSpinsOf(s.metadata?.parts)])),
    [summaries],
  );

  const missingScale = summaries.filter((s) => s.spanM == null);
  const scaleAvailable = missingScale.length === 0 && summaries.length > 0;
  const largestSpan = Math.max(...summaries.map((s) => s.spanM ?? 1));

  const ordered = useMemo(
    () => (scaleAvailable ? summaries.slice().sort((a, b) => (b.spanM ?? 0) - (a.spanM ?? 0)) : summaries),
    [summaries, scaleAvailable],
  );

  return (
    <PageScroll>
      <PageSection maxWidth={1400} style={{ padding: '52px 0 80px' }}>
        <SectionHeading
          pill="The range"
          title="Fleet line-up"
          body={scaleAvailable && trueScale
            ? 'Every aircraft drawn to the same scale, largest first — so the Q4 really is that much smaller than the VTOL. Drag any one of them to turn it.'
            : 'Each aircraft fitted to its own frame, so every one is readable. Sizes here are NOT comparable — switch true scale on for that. Drag any one of them to turn it.'}
          style={{ marginBottom: 26 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <ChromeButton
            label="TRUE SCALE"
            state={scaleAvailable ? onOff(trueScale) : 'N/A'}
            active={trueScale && scaleAvailable}
            disabled={!scaleAvailable}
            onClick={() => scaleAvailable && setTrueScale((v) => !v)}
            style={{ opacity: scaleAvailable ? 1 : 0.5 }}
          />
          <ChromeButton label="SPIN ROTORS" state={onOff(spin)} active={spin} onClick={() => setSpin((v) => !v)} />
          {summaries.length >= 2 && (
            <GhostButton onClick={() => onCompare(ordered[0].product.id, ordered[1].product.id)}>Compare the two largest →</GhostButton>
          )}
        </div>

        {!scaleAvailable && (
          <div style={{
            marginBottom: 20, padding: '12px 16px', borderRadius: theme.radius.md, fontSize: 12.5, lineHeight: 1.55,
            color: theme.color.textSub, background: theme.color.placeholderBg, border: `1px solid ${theme.color.placeholder}33`,
          }}>
            True scale is off because {missingScale.map((s) => s.product.label).join(', ')}{' '}
            publish{missingScale.length === 1 ? 'es' : ''} no real-world dimension. A line-up that scaled some aircraft and not
            others would be worse than one that scales none, so it is disabled entirely.
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
          {ordered.map((s) => (
            <FleetCell
              key={s.product.id}
              summary={s}
              rigs={rigsById[s.product.id]}
              margin={trueScale && scaleAvailable && s.spanM ? SHOWCASE.fleetMargin * (largestSpan / s.spanM) : SHOWCASE.fleetMargin}
              spin={spin}
              turntable={settings.reducedMotion ? 0 : SHOWCASE.fleetTurntable}
              onOpen={() => onOpen(s.product.id)}
            />
          ))}
        </div>

        <div style={{ marginTop: 18, fontSize: 12, color: theme.color.textMuted, lineHeight: 1.6 }}>
          Spans are the longest overall dimension of each airframe, read from the model geometry with the unit declared by
          the source CAD. Everything else on this page is illustrative.
        </div>

        <FleetBuilder summaries={summaries} />
      </PageSection>
    </PageScroll>
  );
}

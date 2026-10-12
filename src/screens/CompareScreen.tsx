import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import ShowcaseCanvas from '../components/engine/ShowcaseCanvas';
import { ChromeButton, GhostButton } from '../components/ui/Buttons';
import { ProvenanceBadge } from '../components/ui/Controls';
import { Accent, DotGrid, SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import { theme } from '../constants/theme';
import { SHOWCASE } from '../constants/viewer';
import { cardStyle, microLabelStyle, monoStyle } from '../styles/primitives';
import { useSettings } from '../lib/settings';
import { onOff } from '../lib/format';
import { rigSpinsOf } from '../lib/metadata';
import { findSpec, formatMtow, formatSpan, summariseProduct, unionSpecLabels } from '../lib/catalogue';
import type { ProductSummary } from '../lib/catalogue';
import type { ProductConfig, ProductMetadataFile, Provenance } from '../types/product';

function SidePicker({ label, summaries, value, exclude, onChange }: {
  label: string;
  summaries: ProductSummary[];
  value: string;
  exclude: string;
  onChange: (id: string) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={microLabelStyle}>{label}</span>
      <select
        className="nw-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minHeight: theme.touchTarget, padding: '0 14px', fontSize: 13.5, color: theme.color.text,
          background: theme.color.surface, border: theme.hairline, borderRadius: theme.radius.md, cursor: 'pointer',
        }}
      >
        {summaries.map((s) => (
          <option key={s.product.id} value={s.product.id} disabled={s.product.id === exclude}>{s.product.label}</option>
        ))}
      </select>
    </label>
  );
}

function DiffTable({ left, right, publishedLabels }: { left: ProductSummary; right: ProductSummary; publishedLabels: string[] }) {
  const rows: { label: string; l: string; r: string; provenance: Provenance }[] = [
    ...left.structure.map((row, i) => ({ label: row.label, l: row.value, r: right.structure[i]?.value ?? '—', provenance: 'measured' as const })),
    { label: 'MTOW envelope', l: formatMtow(left.mtowRange), r: formatMtow(right.mtowRange), provenance: 'placeholder' },
    { label: 'Real-world span', l: formatSpan(left.spanM), r: formatSpan(right.spanM), provenance: 'placeholder' },
    ...publishedLabels.map((label) => ({
      label,
      l: findSpec(left, label)?.value ?? '—',
      r: findSpec(right, label)?.value ?? '—',
      provenance: findSpec(left, label)?.provenance ?? 'placeholder',
    })),
  ];

  const cell: CSSProperties = {
    ...monoStyle, padding: '12px 18px', fontSize: 13, color: theme.color.text, textAlign: 'center',
    borderBottom: `1px solid ${theme.color.borderSub}`,
  };
  const head: CSSProperties = { ...cell, fontFamily: theme.font.ui, fontSize: 15, fontWeight: 600, borderBottom: `2px solid ${theme.color.accent}` };

  return (
    <div style={{ ...cardStyle(), overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ ...head, textAlign: 'left', minWidth: 200 }} />
            <th style={head}>{left.product.label}</th>
            <th style={head}>{right.product.label}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const differs = row.l !== row.r && row.l !== '—' && row.r !== '—';
            return (
              <tr key={row.label} style={{ background: differs ? theme.color.accentGlow : 'transparent' }}>
                <th scope="row" style={{ ...cell, textAlign: 'left', fontFamily: theme.font.ui, fontSize: 12.5, fontWeight: 400, color: theme.color.textSub }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {row.label}
                    <ProvenanceBadge provenance={row.provenance} />
                    {differs && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: theme.color.accentBright }}>DIFFERS</span>}
                  </span>
                </th>
                <td style={cell}>{row.l}</td>
                <td style={cell}>{row.r}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Equal cells + margin ∝ largestSpan / ownSpan gives true relative scale.
export default function CompareScreen({ products, metadataById, leftId, rightId, onChangeSides, onOpen }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  leftId: string;
  rightId: string;
  onChangeSides: (leftId: string, rightId: string) => void;
  onOpen: (productId: string) => void;
}) {
  const [settings] = useSettings();
  const [trueScale, setTrueScale] = useState(true);
  const [spin, setSpin] = useState(false);

  const summaries = useMemo(
    () => products.map((p) => summariseProduct(p, metadataById[p.id] ?? null)),
    [products, metadataById],
  );
  const rigsById = useMemo(
    () => Object.fromEntries(summaries.map((s) => [s.product.id, rigSpinsOf(s.metadata?.parts)])),
    [summaries],
  );
  const left = summaries.find((s) => s.product.id === leftId) ?? summaries[0];
  const right = summaries.find((s) => s.product.id === rightId) ?? summaries[1] ?? summaries[0];

  const scaleAvailable = left?.spanM != null && right?.spanM != null;
  const largestSpan = Math.max(left?.spanM ?? 1, right?.spanM ?? 1);
  const marginFor = (s: ProductSummary) =>
    (trueScale && scaleAvailable && s.spanM ? SHOWCASE.compareMargin * (largestSpan / s.spanM) : SHOWCASE.compareMargin);

  const publishedLabels = useMemo(() => unionSpecLabels([left, right].filter(Boolean)), [left, right]);

  if (!left || !right) return null;

  return (
    <PageScroll>
      <PageSection style={{ padding: '52px 0 80px' }}>
        <SectionHeading
          pill="Side by side"
          size="md"
          title={<>{left.product.label} <span style={{ color: theme.color.textMuted, fontWeight: 400 }}>vs</span> <Accent>{right.product.label}</Accent></>}
          style={{ marginBottom: 26 }}
        />

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <SidePicker label="Left" summaries={summaries} value={left.product.id} exclude={right.product.id} onChange={(id) => onChangeSides(id, right.product.id)} />
          <GhostButton onClick={() => onChangeSides(right.product.id, left.product.id)} aria-label="Swap sides">⇄ Swap</GhostButton>
          <SidePicker label="Right" summaries={summaries} value={right.product.id} exclude={left.product.id} onChange={(id) => onChangeSides(left.product.id, id)} />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <ChromeButton
              label="TRUE SCALE"
              state={scaleAvailable ? onOff(trueScale) : 'N/A'}
              active={trueScale && scaleAvailable}
              disabled={!scaleAvailable}
              onClick={() => scaleAvailable && setTrueScale((v) => !v)}
              style={{ opacity: scaleAvailable ? 1 : 0.5 }}
            />
            <ChromeButton label="SPIN" state={onOff(spin)} active={spin} onClick={() => setSpin((v) => !v)} />
          </div>
        </div>

        {!scaleAvailable && (
          <div style={{
            marginBottom: 18, padding: '12px 16px', borderRadius: theme.radius.md, fontSize: 12.5, lineHeight: 1.55,
            color: theme.color.textSub, background: theme.color.placeholderBg, border: `1px solid ${theme.color.placeholder}33`,
          }}>
            True relative scale is unavailable: {[left, right].filter((s) => s.spanM == null).map((s) => s.product.label).join(' and ')}{' '}
            publish no real-world dimension, so there is nothing to scale against. Both models are fitted to their own frame instead.
          </div>
        )}

        <div style={{ display: 'flex', gap: 20, marginBottom: 26, flexWrap: 'wrap' }}>
          {[left, right].map((s, i) => (
            <div
              key={`${s.product.id}-${i}`}
              style={{ ...cardStyle(), flex: '1 1 320px', minWidth: 300, height: 400, position: 'relative', background: theme.gradient.cardStage }}
            >
              <DotGrid />
              <ShowcaseCanvas
                url={s.product.glbUrl}
                rigs={rigsById[s.product.id]}
                rotorRpm={spin ? SHOWCASE.spinRpm : 0}
                turntableSpeed={settings.reducedMotion ? 0 : SHOWCASE.compareTurntable}
                margin={marginFor(s)}
                interactive
              />
              <div style={{
                position: 'absolute', top: 14, left: 16, padding: '6px 12px', borderRadius: theme.radius.pill, pointerEvents: 'none',
                fontSize: 12, fontWeight: 600, color: theme.color.text, background: theme.color.glass, border: theme.hairline,
              }}>
                {s.product.label}
                {s.spanM != null && <span style={{ ...monoStyle, color: theme.color.textMuted, fontWeight: 400 }}> · {s.spanM.toFixed(2)} m</span>}
              </div>
              <ChromeButton label="OPEN VIEWER" onClick={() => onOpen(s.product.id)} style={{ position: 'absolute', bottom: 16, right: 16, minHeight: 38 }} />
            </div>
          ))}
        </div>

        <DiffTable left={left} right={right} publishedLabels={publishedLabels} />
      </PageSection>
    </PageScroll>
  );
}

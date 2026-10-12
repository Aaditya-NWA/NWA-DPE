import { useMemo, useState } from 'react';
import ShowcaseCanvas from '../components/engine/ShowcaseCanvas';
import { GhostButton, PrimaryButton } from '../components/ui/Buttons';
import { ProvenanceBadge } from '../components/ui/Controls';
import { DotGrid, SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import { theme } from '../constants/theme';
import { SHOWCASE_COPY } from '../constants/content';
import { SHOWCASE } from '../constants/viewer';
import { cardStyle, microLabelStyle, monoStyle, secondaryButtonStyle } from '../styles/primitives';
import { useSettings } from '../lib/settings';
import { rigSpinsOf } from '../lib/metadata';
import type { ProductConfig, ProductMetadataFile, RigSpin, WebsiteProfile } from '../types/product';

interface ShowcaseEntry {
  product: ProductConfig;
  website: WebsiteProfile;
  rigs: RigSpin[] | null;
}

function MtowField({ value, onChange, matchCount, showing, noMatch }: {
  value: string;
  onChange: (v: string) => void;
  matchCount: number;
  showing: number;
  noMatch: boolean;
}) {
  const status = noMatch
    ? `No AXOM airframe covers that weight — showing all ${showing}.`
    : matchCount > 0
      ? `${matchCount} airframe${matchCount === 1 ? '' : 's'} matched.`
      : `Leave blank to see all ${showing} airframes.`;

  return (
    <div style={{ ...cardStyle(), overflow: 'visible', maxWidth: 580, padding: '22px 24px', background: theme.color.surface }}>
      <label htmlFor="mtow" style={{ ...microLabelStyle, display: 'block', marginBottom: 12 }}>{SHOWCASE_COPY.mtowLabel}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', background: theme.color.page,
          border: theme.hairline, borderRadius: theme.radius.md, paddingRight: 14,
        }}>
          <input
            id="mtow"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={SHOWCASE_COPY.mtowPlaceholder}
            style={{
              ...monoStyle, flex: 1, minWidth: 0, minHeight: theme.touchTarget + 4, padding: '0 16px',
              fontSize: 19, color: theme.color.text, background: 'none', border: 'none', outline: 'none',
            }}
          />
          <span style={{ ...monoStyle, fontSize: 15, color: theme.color.textMuted }}>kg</span>
        </div>
        {value !== '' && <GhostButton onClick={() => onChange('')}>Clear</GhostButton>}
      </div>
      <div style={{ marginTop: 10, fontSize: 12.5, color: noMatch ? theme.color.amber : theme.color.textMuted }}>{status}</div>
    </div>
  );
}

function ProductCard({ entry, recommended, dimmed, turntableSpeed, rotorRpm, onFly }: {
  entry: ShowcaseEntry;
  recommended: boolean;
  dimmed: boolean;
  turntableSpeed: number;
  rotorRpm: number;
  onFly: () => void;
}) {
  const { product, website, rigs } = entry;
  return (
    <div style={{
      ...cardStyle(), display: 'flex', flexDirection: 'column',
      border: `1px solid ${recommended ? theme.color.accent : theme.color.border}`,
      boxShadow: recommended ? theme.shadow.lifted : 'none',
      opacity: dimmed ? 0.55 : 1, transition: 'opacity 250ms, border-color 250ms',
    }}>
      <div style={{ position: 'relative', height: 270, background: theme.gradient.cardStage, borderBottom: theme.hairline }}>
        <DotGrid />
        <ShowcaseCanvas url={product.glbUrl} rigs={rigs} rotorRpm={rotorRpm} turntableSpeed={turntableSpeed} />
        {recommended && (
          <div style={{
            position: 'absolute', top: 16, left: 16, padding: '6px 12px', borderRadius: theme.radius.pill,
            background: theme.color.accent, color: theme.color.textOnAccent,
            fontSize: 10.5, fontWeight: 700, letterSpacing: '0.12em',
          }}>
            RECOMMENDED
          </div>
        )}
      </div>

      <div style={{ padding: '22px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: theme.color.text, letterSpacing: '-0.01em' }}>{product.label}</div>
          <div style={{ fontSize: 13.5, color: theme.color.textSub, lineHeight: 1.6, marginTop: 6 }}>{website.tagline}</div>
        </div>

        <dl style={{ margin: 0 }}>
          {website.keySpecs.map((spec, i) => (
            <div key={spec.label} style={{
              display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${theme.color.borderSub}`,
            }}>
              <dt style={{ fontSize: 12.5, color: theme.color.textMuted }}>{spec.label}</dt>
              <dd style={{ ...monoStyle, margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: theme.color.text, textAlign: 'right' }}>
                {spec.value}
                {spec.provenance === 'measured' && <ProvenanceBadge provenance="measured" />}
              </dd>
            </div>
          ))}
        </dl>

        <div style={{ fontSize: 11.5, lineHeight: 1.55, color: theme.color.textMuted }}>{SHOWCASE_COPY.disclaimer}</div>

        <div style={{ marginTop: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <PrimaryButton onClick={onFly} style={{ flex: 1, minWidth: 150 }}>Fly this aircraft →</PrimaryButton>
          {website.datasheetUrl && (
            <a className="nw-btn-ghost" href={website.datasheetUrl} download style={{ ...secondaryButtonStyle(), textDecoration: 'none' }}>
              Data sheet
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Presence of a `website` block publishes a product here; the recommendation is a pure range test.
export default function ShowcaseScreen({ products, metadataById, onFly }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  onFly: (productId: string) => void;
}) {
  const [mtowInput, setMtowInput] = useState('');
  const [settings] = useSettings();

  const entries = useMemo<ShowcaseEntry[]>(() => products.flatMap((product) => {
    const meta = metadataById[product.id];
    if (!meta?.website) return [];
    return [{ product, website: meta.website, rigs: rigSpinsOf(meta.parts) }];
  }), [products, metadataById]);

  const mtow = mtowInput.trim() === '' ? null : Number(mtowInput);
  const mtowValid = mtow !== null && Number.isFinite(mtow) && mtow > 0;

  const recommended = useMemo(() => {
    if (!mtowValid) return new Set<string>();
    return new Set(entries
      .filter((e) => mtow >= e.website.mtowKg.min && mtow <= e.website.mtowKg.max)
      .map((e) => e.product.id));
  }, [entries, mtow, mtowValid]);

  const noMatch = mtowValid && recommended.size === 0;

  return (
    <PageScroll>
      <PageSection style={{ padding: '60px 0 88px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40 }}>
          <SectionHeading pill={SHOWCASE_COPY.pill} title={SHOWCASE_COPY.title} body={SHOWCASE_COPY.body} style={{ flex: '1 1 380px' }} />
          <div style={{ flex: '1 1 420px', display: 'flex', justifyContent: 'flex-end' }}>
            <MtowField
              value={mtowInput}
              onChange={setMtowInput}
              matchCount={recommended.size}
              showing={entries.length}
              noMatch={noMatch}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 22 }}>
          {entries.map((entry) => (
            <ProductCard
              key={entry.product.id}
              entry={entry}
              recommended={recommended.has(entry.product.id)}
              dimmed={recommended.size > 0 && !recommended.has(entry.product.id)}
              turntableSpeed={settings.reducedMotion ? 0 : SHOWCASE.turntableSpeed}
              rotorRpm={settings.reducedMotion ? 0 : SHOWCASE.rotorRpm}
              onFly={() => onFly(entry.product.id)}
            />
          ))}
        </div>
      </PageSection>
    </PageScroll>
  );
}

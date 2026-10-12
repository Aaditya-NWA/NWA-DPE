import { theme } from '../constants/theme';
import { MENU } from '../constants/content';
import { cardStyle, eyebrowStyle, microLabelStyle } from '../styles/primitives';
import { countOverrides, useOverrides } from '../lib/overrides';
import { plural } from '../lib/format';
import AirframeGlyph from '../components/ui/AirframeGlyph';
import { DotGrid, SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import type { ProductConfig, ProductMetadataFile, ViewMode } from '../types/product';

type Action = (typeof MENU.actions)[keyof typeof MENU.actions];

function ActionCard({ action, badge, onClick }: { action: Action; badge?: string; onClick: () => void }) {
  return (
    <button
      className="nw-card"
      onClick={onClick}
      style={{
        ...cardStyle(), textAlign: 'left', cursor: 'pointer', padding: '26px 24px',
        display: 'flex', flexDirection: 'column', gap: 12, minHeight: 190,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{
          width: 36, height: 36, borderRadius: theme.radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.color.surface, border: theme.hairline, fontSize: 16, color: theme.color.accent,
        }}>
          {action.icon}
        </span>
        {badge
          ? <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: theme.color.placeholder }}>{badge}</span>
          : <span style={{ ...microLabelStyle, color: theme.color.textDim }}>{action.label}</span>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: theme.color.text, marginBottom: 8 }}>{action.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: theme.color.textSub }}>{action.desc}</div>
      </div>
      <span className="nw-card-cta" style={{ fontSize: 13, fontWeight: 500, color: theme.color.accent, transition: 'color 200ms' }}>
        {action.cta} →
      </span>
    </button>
  );
}

// Opening a product stays first; catalogue-level destinations sit below the grid.
export default function ExpoMenuScreen({ products, metadataById, onSelect, onNavigate }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  onSelect: (id: string) => void;
  onNavigate: (view: ViewMode) => void;
}) {
  const localEdits = countOverrides(useOverrides());
  const sectionCount = (id: string) => Object.keys(metadataById[id]?.sections ?? {}).length;

  return (
    <PageScroll>
      <PageSection style={{ padding: '64px 0 20px' }}>
        <SectionHeading pill={MENU.pill} title={MENU.title} body={MENU.body} style={{ marginBottom: 40 }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 20 }}>
          {products.map((p) => {
            const sections = sectionCount(p.id);
            return (
              <button
                key={p.id}
                className="nw-card"
                onClick={() => onSelect(p.id)}
                style={{ ...cardStyle(), textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{
                  position: 'relative', height: 168, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: theme.gradient.cardStage, borderBottom: theme.hairline,
                }}>
                  <DotGrid />
                  <div className="nw-card-img" style={{ position: 'relative', transition: 'transform 500ms' }}>
                    <AirframeGlyph silhouette={p.silhouette} height={122} />
                  </div>
                </div>
                <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 9, flex: 1 }}>
                  <div style={{ ...eyebrowStyle, fontSize: 10, letterSpacing: '0.14em' }}>{p.kicker}</div>
                  <div style={{ fontSize: 21, fontWeight: 700, color: theme.color.text, letterSpacing: '-0.01em' }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: theme.color.textSub, lineHeight: 1.6 }}>{p.blurb}</div>
                  <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className="nw-card-cta" style={{ fontSize: 13, fontWeight: 600, color: theme.color.accent, transition: 'color 200ms' }}>
                      Open viewer →
                    </span>
                    {sections > 0 && (
                      <span style={{ marginLeft: 'auto', ...microLabelStyle, fontSize: 10 }}>{sections} sections</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PageSection>

      <PageSection style={{ padding: '56px 0 88px' }}>
        <SectionHeading pill={MENU.rangePill} title={MENU.rangeTitle} size="md" style={{ marginBottom: 28 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          <ActionCard action={MENU.actions.fleet} onClick={() => onNavigate({ screen: 'fleet' })} />
          <ActionCard action={MENU.actions.specs} onClick={() => onNavigate({ screen: 'specs' })} />
          {products.length >= 2 && (
            <ActionCard
              action={MENU.actions.compare}
              onClick={() => onNavigate({ screen: 'compare', leftId: products[0].id, rightId: products[1].id })}
            />
          )}
          <ActionCard
            action={MENU.actions.admin}
            badge={localEdits > 0 ? plural(localEdits, 'EDIT') : undefined}
            onClick={() => onNavigate({ screen: 'admin' })}
          />
        </div>
      </PageSection>
    </PageScroll>
  );
}

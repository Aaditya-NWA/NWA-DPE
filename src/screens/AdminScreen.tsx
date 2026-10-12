import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { GhostButton, PrimaryButton } from '../components/ui/Buttons';
import { SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import { theme } from '../constants/theme';
import { cardStyle, microLabelStyle, monoStyle } from '../styles/primitives';
import {
  clearAllOverrides,
  clearProductOverrides,
  countOverrides,
  setProductNameOverride,
  setTextOverride,
  useOverrides,
} from '../lib/overrides';
import { plural } from '../lib/format';
import type { ProductConfig, ProductMetadataFile } from '../types/product';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ ...cardStyle(), padding: '22px 24px' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 600, color: theme.color.text }}>{title}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
    </section>
  );
}

// Shipped text is the placeholder; only the difference is stored, so clearing restores it.
function Field({ label, shipped, override, onChange, multiline = false }: {
  label: string;
  shipped: string;
  override?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const dirty = override !== undefined;
  const shared: CSSProperties = {
    width: '100%', padding: '11px 14px', fontSize: 13.5, lineHeight: 1.5, color: theme.color.text,
    background: dirty ? theme.color.placeholderBg : theme.color.surface,
    border: `1px solid ${dirty ? theme.color.placeholder : theme.color.border}`,
    borderRadius: theme.radius.md, outline: 'none', fontFamily: theme.font.ui,
  };

  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...microLabelStyle, fontSize: 10, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
        {label}
        {dirty && <span style={{ color: theme.color.placeholder }}>· Edited locally</span>}
      </span>
      {multiline ? (
        <textarea className="nw-input" value={override ?? ''} placeholder={shipped} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...shared, minHeight: 66, resize: 'vertical' }} />
      ) : (
        <input className="nw-input" value={override ?? ''} placeholder={shipped} onChange={(e) => onChange(e.target.value)} style={{ ...shared, minHeight: theme.touchTarget }} />
      )}
      {dirty && (
        <span style={{ display: 'block', marginTop: 6, fontSize: 11.5, color: theme.color.textMuted, lineHeight: 1.45 }}>
          Shipped text: “{shipped}”. Clear the box to restore it.
        </span>
      )}
    </label>
  );
}

function EntryBlock({ meta, children }: { meta: string; children: ReactNode }) {
  return (
    <div style={{ paddingBottom: 16, borderBottom: `1px solid ${theme.color.borderSub}` }}>
      <div style={{ ...monoStyle, fontSize: 10.5, color: theme.color.textMuted, marginBottom: 10 }}>{meta}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

// Text-only, local-to-this-machine editor. The export is how an edit gets back into the repo.
export default function AdminScreen({ products, metadataById, onOpen }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  onOpen: (productId: string) => void;
}) {
  const overrides = useOverrides();
  const [activeId, setActiveId] = useState(products[0]?.id ?? '');
  const [exportOpen, setExportOpen] = useState(false);

  const product = products.find((p) => p.id === activeId) ?? products[0];
  const metadata = product ? metadataById[product.id] : undefined;
  const productOverride = product ? overrides[product.id] : undefined;
  const total = countOverrides(overrides);
  const exportJson = useMemo(() => JSON.stringify(overrides, null, 2), [overrides]);

  if (!product) return null;

  return (
    <PageScroll>
      <PageSection maxWidth={1120} style={{ padding: '52px 0 80px' }}>
        <SectionHeading
          pill="Kiosk content"
          title="Edit copy on this machine"
          body={<>Corrects names and descriptions without a rebuild. Changes are stored in this browser only — they apply to <strong style={{ color: theme.color.text }}>this kiosk</strong>, survive a restart, and do not reach any other machine or the repository.</>}
          style={{ marginBottom: 12 }}
        />
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: theme.color.textMuted, margin: '0 0 26px', maxWidth: 760 }}>
          Structure — which solids belong to which section, which components can spin, flight envelopes — is not editable
          here. Those are validated by offline checks before they ship, and a free-text edit of them on a touchscreen would
          break the viewer rather than improve it.
        </p>

        <div style={{
          display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '14px 18px', marginBottom: 24,
          borderRadius: theme.radius.lg,
          background: total > 0 ? theme.color.placeholderBg : theme.color.surface,
          border: `1px solid ${total > 0 ? `${theme.color.placeholder}40` : theme.color.border}`,
        }}>
          <span style={{ fontSize: 13.5, color: theme.color.textSub }}>
            {total === 0 ? 'No local edits. Everything on this kiosk is the shipped copy.' : `${total} local edit${total === 1 ? '' : 's'} active on this kiosk.`}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <GhostButton onClick={() => setExportOpen((v) => !v)} disabled={total === 0} style={{ opacity: total === 0 ? 0.5 : 1 }}>
              {exportOpen ? 'Hide export' : 'Export for the repo'}
            </GhostButton>
            <GhostButton onClick={() => clearAllOverrides()} disabled={total === 0} style={{ opacity: total === 0 ? 0.5 : 1 }}>
              Discard all edits
            </GhostButton>
          </div>
        </div>

        {exportOpen && total > 0 && (
          <div style={{ marginBottom: 26 }}>
            <p style={{ fontSize: 13, color: theme.color.textSub, lineHeight: 1.6, margin: '0 0 10px' }}>
              Copy this into the ticket or the commit that applies these corrections to
              <code style={{ ...monoStyle, margin: '0 4px', color: theme.color.accentBright }}>public/metadata/*.json</code>.
              Once the repo carries the text, discard the local edits so the kiosk goes back to shipped copy.
            </p>
            <textarea
              readOnly
              value={exportJson}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                ...monoStyle, width: '100%', minHeight: 220, padding: 16, fontSize: 12, lineHeight: 1.55,
                color: theme.color.accentBright, background: theme.color.sunken, border: theme.hairline,
                borderRadius: theme.radius.md, resize: 'vertical',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {products.map((p) => {
            const active = p.id === product.id;
            const edits = countOverrides({ [p.id]: overrides[p.id] ?? {} });
            return (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                aria-pressed={active}
                style={{
                  minHeight: theme.touchTarget, padding: '0 18px', cursor: 'pointer',
                  fontSize: 13.5, fontWeight: active ? 700 : 500, borderRadius: theme.radius.pill,
                  color: active ? theme.color.textOnAccent : theme.color.textSub,
                  background: active ? theme.color.accent : theme.color.surface,
                  border: `1px solid ${active ? theme.color.accent : theme.color.border}`,
                }}
              >
                {p.label}
                {edits > 0 && <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 8, opacity: 0.85 }}>{plural(edits, 'EDIT')}</span>}
              </button>
            );
          })}
        </div>

        {!metadata ? (
          <div style={{ padding: 20, fontSize: 14, color: theme.color.textMuted }}>
            Metadata for {product.label} did not load, so there is nothing to edit.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Group title="Product">
              <Field
                label="Product name"
                shipped={metadata.productName}
                override={productOverride?.productName}
                onChange={(v) => setProductNameOverride(product.id, v)}
              />
            </Group>

            {metadata.sections && Object.keys(metadata.sections).length > 0 && (
              <Group title={`Sections · ${Object.keys(metadata.sections).length}`}>
                {Object.entries(metadata.sections).map(([id, section]) => (
                  <EntryBlock key={id} meta={`${id} · ${section.memberNodeKeys.length} SOLIDS`}>
                    <Field
                      label="Display name"
                      shipped={section.displayName}
                      override={productOverride?.sections?.[id]?.displayName}
                      onChange={(v) => setTextOverride(product.id, 'sections', id, 'displayName', v)}
                    />
                    <Field
                      label="Description"
                      multiline
                      shipped={section.description}
                      override={productOverride?.sections?.[id]?.description}
                      onChange={(v) => setTextOverride(product.id, 'sections', id, 'description', v)}
                    />
                  </EntryBlock>
                ))}
              </Group>
            )}

            <Group title={`Components · ${Object.keys(metadata.parts).length}`}>
              {Object.entries(metadata.parts).map(([key, part]) => (
                <EntryBlock key={key} meta={`${key}${part.rig ? ' · RIG' : ''}${part.rig?.pitch ? ' · PITCH' : ''}`}>
                  <Field
                    label="Display name"
                    shipped={part.displayName}
                    override={productOverride?.parts?.[key]?.displayName}
                    onChange={(v) => setTextOverride(product.id, 'parts', key, 'displayName', v)}
                  />
                  <Field
                    label="Description"
                    multiline
                    shipped={part.description}
                    override={productOverride?.parts?.[key]?.description}
                    onChange={(v) => setTextOverride(product.id, 'parts', key, 'description', v)}
                  />
                </EntryBlock>
              ))}
            </Group>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <PrimaryButton onClick={() => onOpen(product.id)}>Open {product.label} in the viewer →</PrimaryButton>
              <GhostButton onClick={() => clearProductOverrides(product.id)} disabled={!productOverride} style={{ opacity: productOverride ? 1 : 0.5 }}>
                Discard edits for {product.label}
              </GhostButton>
            </div>
          </div>
        )}
      </PageSection>
    </PageScroll>
  );
}

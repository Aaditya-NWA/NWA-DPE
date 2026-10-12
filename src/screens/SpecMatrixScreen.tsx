import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { GhostButton } from '../components/ui/Buttons';
import { ProvenanceBadge } from '../components/ui/Controls';
import { SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import { theme } from '../constants/theme';
import { cardStyle, microLabelStyle, monoStyle } from '../styles/primitives';
import { findSpec, formatMtow, formatSpan, summariseProduct, unionSpecLabels } from '../lib/catalogue';
import type { ProductConfig, ProductMetadataFile, Provenance } from '../types/product';

function BandRow({ span, title, provenance }: { span: number; title: string; provenance: Provenance }) {
  return (
    <tr>
      <td colSpan={span} style={{
        padding: '14px 18px', position: 'sticky', left: 0,
        background: provenance === 'measured' ? theme.color.measuredBg : theme.color.placeholderBg,
        borderTop: theme.hairline, borderBottom: theme.hairline,
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <ProvenanceBadge provenance={provenance} />
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.color.text }}>{title}</span>
        </span>
      </td>
    </tr>
  );
}

// Counted structure and illustrative figures are banded apart so one never borrows the other's authority.
export default function SpecMatrixScreen({ products, metadataById, onOpen, onCompare }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  onOpen: (productId: string) => void;
  onCompare: (leftId: string, rightId: string) => void;
}) {
  const summaries = useMemo(
    () => products.map((p) => summariseProduct(p, metadataById[p.id] ?? null)),
    [products, metadataById],
  );
  const publishedLabels = useMemo(() => unionSpecLabels(summaries), [summaries]);
  const [showPlaceholders, setShowPlaceholders] = useState(true);

  const labelCol: CSSProperties = {
    position: 'sticky', left: 0, zIndex: 1, background: theme.color.card,
    fontSize: 13, fontWeight: 400, color: theme.color.textSub, padding: '13px 18px', textAlign: 'left',
    borderRight: theme.hairline, borderBottom: `1px solid ${theme.color.borderSub}`, minWidth: 210,
  };
  const cell: CSSProperties = {
    ...monoStyle, padding: '13px 18px', textAlign: 'center', minWidth: 150, fontSize: 13,
    color: theme.color.text, borderBottom: `1px solid ${theme.color.borderSub}`,
  };
  const note = (text: string) => (
    <span style={{ display: 'block', fontSize: 11, color: theme.color.textMuted, marginTop: 3, lineHeight: 1.45 }}>{text}</span>
  );

  return (
    <PageScroll>
      <PageSection style={{ padding: '56px 0 80px' }}>
        <SectionHeading
          pill="Compare the range"
          title="Specification matrix"
          body="Every product in the catalogue, side by side. Structural figures are counted from the model files themselves. Performance figures are illustrative stand-ins until real NWA data replaces them — the badges say which is which."
          style={{ marginBottom: 26 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}>
          <GhostButton onClick={() => setShowPlaceholders((v) => !v)}>
            {showPlaceholders ? 'Hide placeholder figures' : 'Show placeholder figures'}
          </GhostButton>
          {summaries.length >= 2 && (
            <GhostButton onClick={() => onCompare(summaries[0].product.id, summaries[1].product.id)}>
              Open side-by-side 3D compare →
            </GhostButton>
          )}
        </div>

        <div style={{ ...cardStyle(), overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...labelCol, borderBottom: `2px solid ${theme.color.accent}` }} />
                {summaries.map((s) => (
                  <th key={s.product.id} style={{ ...cell, fontFamily: theme.font.ui, verticalAlign: 'bottom', borderBottom: `2px solid ${theme.color.accent}`, paddingTop: 18 }}>
                    <div style={{ fontSize: 17, fontWeight: 700, color: theme.color.text }}>{s.product.label}</div>
                    <div style={{ ...microLabelStyle, fontSize: 9.5, marginTop: 5 }}>{s.onWebsite ? 'Expos + Website' : 'Expos only'}</div>
                    <GhostButton onClick={() => onOpen(s.product.id)} style={{ marginTop: 12, minHeight: 36, padding: '0 14px', fontSize: 12 }}>
                      Open
                    </GhostButton>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <BandRow span={summaries.length + 1} title="Structure — counted from the model files" provenance="measured" />
              {summaries[0]?.structure.map((row, rowIndex) => (
                <tr key={row.label}>
                  <th scope="row" style={labelCol}>{row.label}{row.note && note(row.note)}</th>
                  {summaries.map((s) => <td key={s.product.id} style={cell}>{s.structure[rowIndex]?.value ?? '—'}</td>)}
                </tr>
              ))}

              {showPlaceholders && (
                <>
                  <BandRow span={summaries.length + 1} title="Published performance — illustrative, not a specification" provenance="placeholder" />
                  <tr>
                    <th scope="row" style={labelCol}>MTOW envelope</th>
                    {summaries.map((s) => <td key={s.product.id} style={cell}>{formatMtow(s.mtowRange)}</td>)}
                  </tr>
                  <tr>
                    <th scope="row" style={labelCol}>Real-world span{note('Longest overall dimension.')}</th>
                    {summaries.map((s) => <td key={s.product.id} style={cell}>{formatSpan(s.spanM)}</td>)}
                  </tr>
                  {publishedLabels.map((label) => (
                    <tr key={label}>
                      <th scope="row" style={labelCol}>{label}</th>
                      {summaries.map((s) => <td key={s.product.id} style={cell}>{findSpec(s, label)?.value ?? '—'}</td>)}
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </PageScroll>
  );
}

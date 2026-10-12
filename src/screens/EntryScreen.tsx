import { useMemo } from 'react';
import { theme } from '../constants/theme';
import { ENTRY, IMAGES } from '../constants/content';
import { cardStyle, eyebrowStyle } from '../styles/primitives';
import { GhostButton, PrimaryButton } from '../components/ui/Buttons';
import { Accent, DotGrid, Pill, SectionHeading } from '../components/ui/Typography';
import { PageScroll, PageSection } from '../components/layout/Page';
import type { ProductConfig, ProductMetadataFile } from '../types/product';

type Door = 'expos' | 'website';

function DoorCard({ door, image, onClick }: { door: (typeof ENTRY.doors)[Door]; image: string; onClick: () => void }) {
  return (
    <button
      className="nw-card"
      onClick={onClick}
      style={{ ...cardStyle(), textAlign: 'left', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ height: 200, width: '100%', overflow: 'hidden', position: 'relative', background: theme.color.pageDeep }}>
        <img
          className="nw-card-img"
          src={image}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.42) saturate(0.7)', transition: 'transform 500ms' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 70% 40%, rgba(89,162,184,0.12) 0%, transparent 70%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 90, background: `linear-gradient(transparent, ${theme.color.card})` }} />
        <div style={{ position: 'absolute', top: 18, left: 20 }}><Pill>{door.kicker}</Pill></div>
      </div>
      <div style={{ padding: '6px 26px 26px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div style={{ fontSize: 28, fontWeight: 700, color: theme.color.text, letterSpacing: '-0.01em' }}>{door.title}</div>
        <div style={{ fontSize: 14, color: theme.color.textSub, lineHeight: 1.65 }}>{door.body}</div>
        <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {door.points.map((p) => (
            <li key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: theme.color.textMuted }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: theme.color.accent, flexShrink: 0 }} />
              {p}
            </li>
          ))}
        </ul>
        <span className="nw-card-cta" style={{ marginTop: 'auto', paddingTop: 12, fontSize: 13.5, fontWeight: 600, color: theme.color.accent, transition: 'color 200ms' }}>
          {door.cta} →
        </span>
      </div>
    </button>
  );
}

export default function EntryScreen({ products, metadataById, onSelect }: {
  products: ProductConfig[];
  metadataById: Record<string, ProductMetadataFile>;
  onSelect: (door: Door) => void;
}) {
  const stats = useMemo(() => {
    const files = Object.values(metadataById);
    const sections = files.reduce((n, m) => n + Object.keys(m.sections ?? {}).length, 0);
    const rigs = files.reduce((n, m) => n + Object.values(m.parts).filter((p) => p.rig).length, 0);
    return [
      { value: String(products.length), label: 'Airframes' },
      { value: files.length ? String(sections) : '—', label: 'Authored sections' },
      { value: files.length ? String(rigs) : '—', label: 'Drivable rotor rigs' },
    ];
  }, [products, metadataById]);

  return (
    <PageScroll>
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: theme.hairline }}>
        <div style={{ position: 'absolute', top: '-20%', right: '10%', width: 520, height: 520, borderRadius: '50%', background: theme.gradient.glowTeal, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 0, left: '30%', width: 320, height: 320, borderRadius: '50%', background: theme.gradient.glowBlue, pointerEvents: 'none' }} />
        <DotGrid />

        <div className="nw-split" style={{ maxWidth: 1280, margin: '0 auto', padding: '0 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '80px 56px 72px 0' }}>
            <Pill>{ENTRY.pill}</Pill>
            <h1 style={{ fontWeight: 700, fontSize: 'clamp(38px, 4.6vw, 60px)', lineHeight: 1.08, color: theme.color.text, margin: '22px 0 18px', letterSpacing: '-0.02em' }}>
              {ENTRY.titleLead}<br /><Accent>{ENTRY.titleAccent}</Accent>
            </h1>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: theme.color.textSub, margin: '0 0 34px', maxWidth: 440 }}>{ENTRY.body}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <PrimaryButton onClick={() => onSelect('expos')} style={{ padding: '0 26px' }}>{ENTRY.doors.expos.cta}</PrimaryButton>
              <GhostButton onClick={() => onSelect('website')} style={{ padding: '0 26px' }}>{ENTRY.doors.website.cta}</GhostButton>
            </div>
            <div style={{ display: 'flex', gap: 36, paddingTop: 28, marginTop: 40, borderTop: theme.hairline, flexWrap: 'wrap' }}>
              {stats.map((s) => (
                <div key={s.label}>
                  <div style={{ fontWeight: 700, fontSize: 24, color: theme.color.text }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: theme.color.textMuted, marginTop: 3, letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="nw-split-visual" style={{ position: 'relative', overflow: 'hidden', minHeight: 480, background: theme.color.pageDeep }}>
            <img src={IMAGES.hero} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'brightness(0.4) saturate(0.65)' }} />
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, ${theme.color.page} 0%, transparent 45%)` }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 150, background: `linear-gradient(transparent, ${theme.color.page})` }} />
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(89,162,184,0.1) 0%, transparent 70%)' }} />
            <div style={{ ...eyebrowStyle, position: 'absolute', bottom: 26, right: 26, fontSize: 10.5, letterSpacing: '0.16em', opacity: 0.6 }}>
              {ENTRY.heroLabel}
            </div>
          </div>
        </div>
      </section>

      <PageSection style={{ padding: '72px 0 88px' }}>
        <SectionHeading pill={ENTRY.doorsPill} title={ENTRY.doorsTitle} style={{ marginBottom: 40 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
          <DoorCard door={ENTRY.doors.expos} image={IMAGES.expos} onClick={() => onSelect('expos')} />
          <DoorCard door={ENTRY.doors.website} image={IMAGES.website} onClick={() => onSelect('website')} />
        </div>
      </PageSection>
    </PageScroll>
  );
}

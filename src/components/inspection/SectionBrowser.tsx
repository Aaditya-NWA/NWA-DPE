import { useMemo, useState } from 'react';
import { theme } from '../../constants/theme';
import { eyebrowStyle, inputStyle, overlayPanelStyle } from '../../styles/primitives';
import { ChromeButton } from '../ui/Buttons';
import SectionIcon from './SectionIcon';
import type { SectionMetadata } from '../../types/product';

// Search, filter and "where am I" in one panel. Picking reports the first member key, exactly like a tap.
export default function SectionBrowser({ sections, activeSectionId, riggedSectionIds, onPick }: {
  sections: Record<string, SectionMetadata>;
  activeSectionId: string | null;
  riggedSectionIds: Set<string>;
  onPick: (sectionId: string, firstMemberKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const entries = useMemo(() => Object.entries(sections), [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([id, s]) =>
      s.displayName.toLowerCase().includes(q)
      || s.description.toLowerCase().includes(q)
      || id.toLowerCase().includes(q));
  }, [entries, query]);

  const activeIndex = activeSectionId ? entries.findIndex(([id]) => id === activeSectionId) : -1;

  if (entries.length === 0) return null;

  if (!open) {
    return (
      <ChromeButton
        onClick={() => setOpen(true)}
        style={{ position: 'absolute', bottom: 24, left: 24 }}
        label={(
          <>
            SECTIONS · {entries.length}
            {activeIndex >= 0 && <span style={{ color: theme.color.accentBright }}> · {activeIndex + 1}/{entries.length}</span>}
          </>
        )}
      />
    );
  }

  return (
    <div
      className="nw-fade-up"
      style={{
        ...overlayPanelStyle(),
        position: 'absolute', bottom: 24, left: 24, width: 330,
        maxHeight: 'min(430px, calc(100% - 48px))', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ padding: '16px 16px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...eyebrowStyle, fontSize: 10.5, flex: 1 }}>Sections · {filtered.length}/{entries.length}</div>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close section list"
          style={{
            minWidth: 34, minHeight: 34, border: theme.hairline, borderRadius: theme.radius.sm,
            background: theme.color.surface, color: theme.color.textSub, cursor: 'pointer', fontSize: 15,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <input
          className="nw-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sections…"
          style={{ ...inputStyle(), padding: '0 12px', fontSize: 14 }}
        />
      </div>

      <div style={{ overflowY: 'auto', padding: '0 10px 12px' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '14px 6px', fontSize: 12.5, color: theme.color.textMuted, lineHeight: 1.5 }}>
            Nothing matches “{query}”. Section names and descriptions are searched.
          </div>
        )}
        {filtered.map(([id, section]) => {
          const isActive = id === activeSectionId;
          const first = section.memberNodeKeys[0];
          return (
            <button
              key={id}
              className={isActive ? undefined : 'nw-row'}
              onClick={() => first && onPick(id, first)}
              disabled={!first}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                minHeight: theme.touchTarget, padding: '8px 10px', marginBottom: 2,
                textAlign: 'left', cursor: first ? 'pointer' : 'default',
                background: isActive ? theme.color.accentGlow : 'transparent',
                border: `1px solid ${isActive ? theme.color.accentLine : 'transparent'}`,
                borderRadius: theme.radius.sm,
              }}
            >
              <span style={{
                width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: isActive ? theme.color.accentSoft : theme.color.surface, border: theme.hairline,
              }}>
                <SectionIcon sectionId={id} color={isActive ? theme.color.accentBright : theme.color.accent} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  display: 'block', fontSize: 13, lineHeight: 1.35, color: theme.color.text,
                  fontWeight: isActive ? 600 : 400,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {section.displayName}
                </span>
                <span style={{ fontSize: 10, fontWeight: 600, color: theme.color.textMuted, letterSpacing: '0.08em' }}>
                  {section.memberNodeKeys.length} SOLIDS
                  {riggedSectionIds.has(id) && <span style={{ color: theme.color.accent }}> · RIG</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

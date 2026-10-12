import { theme } from '../../constants/theme';
import { glyphForSection } from '../../lib/glyphs';

// Schematic glyph chosen by keyword over the authored section slug — lookup, not geometry.
export default function SectionIcon({ sectionId, size = 16, color }: {
  sectionId: string;
  size?: number;
  color?: string;
}) {
  const glyph = glyphForSection(sectionId);
  const common = {
    stroke: color ?? theme.color.accent,
    strokeWidth: 1.6,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      {glyph === 'rotor' && (
        <>
          <circle cx="10" cy="10" r="2" {...common} />
          <path d="M10 8 L10 2 M10 12 L10 18" {...common} />
          <path d="M8 10 L2 10 M12 10 L18 10" {...common} opacity={0.45} />
        </>
      )}
      {glyph === 'frame' && (
        <>
          <rect x="6" y="6" width="8" height="8" rx="1" {...common} />
          <path d="M6 6 L2 2 M14 6 L18 2 M6 14 L2 18 M14 14 L18 18" {...common} />
        </>
      )}
      {glyph === 'avionics' && (
        <>
          <rect x="4" y="6" width="12" height="8" rx="1.5" {...common} />
          <path d="M7 10 L9 10 M11 10 L13 10 M10 6 L10 4 M10 14 L10 16" {...common} />
        </>
      )}
      {glyph === 'power' && (
        <>
          <rect x="3" y="7" width="12" height="6" rx="1.5" {...common} />
          <path d="M15 9 L17 9 L17 11 L15 11" {...common} />
          <path d="M6 10 L9 10" {...common} />
        </>
      )}
      {glyph === 'gear' && (
        <>
          <path d="M6 4 L6 13 M14 4 L14 13" {...common} />
          <path d="M3 16 L9 16 M11 16 L17 16" {...common} />
        </>
      )}
      {glyph === 'sensor' && (
        <>
          <path d="M6 5 L14 5 L14 9 A4 4 0 0 1 6 9 Z" {...common} />
          <circle cx="10" cy="9" r="1.6" {...common} />
        </>
      )}
      {glyph === 'wing' && <path d="M2 13 L11 5 L18 5 L14 13 Z" {...common} />}
      {glyph === 'boom' && (
        <>
          <path d="M3 10 L17 10" {...common} />
          <circle cx="4" cy="10" r="1.6" {...common} />
          <circle cx="16" cy="10" r="1.6" {...common} />
        </>
      )}
      {glyph === 'tail' && <path d="M4 14 L10 14 L13 5 L15 14 L17 14" {...common} />}
      {glyph === 'body' && <ellipse cx="10" cy="10" rx="7.5" ry="4" {...common} />}
      {glyph === 'generic' && <circle cx="10" cy="10" r="3.4" {...common} />}
    </svg>
  );
}

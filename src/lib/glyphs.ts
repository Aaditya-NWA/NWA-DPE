import { SECTION_GLYPH_RULES } from '../constants/glyphs';
import type { SectionGlyph } from '../constants/glyphs';
import { SECTION_KEY_PREFIX } from '../constants/products';

export function glyphForSection(sectionId: string): SectionGlyph {
  const slug = sectionId.replace(SECTION_KEY_PREFIX, '').toLowerCase();
  return SECTION_GLYPH_RULES.find((r) => r.test.test(slug))?.glyph ?? 'generic';
}

export type SectionGlyph =
  | 'rotor' | 'frame' | 'avionics' | 'power' | 'gear' | 'sensor'
  | 'wing' | 'boom' | 'tail' | 'body' | 'generic';

// First match wins, so more specific keywords come first.
export const SECTION_GLYPH_RULES: { test: RegExp; glyph: SectionGlyph }[] = [
  { test: /rotor|prop|motor/, glyph: 'rotor' },
  { test: /landing|gear|skid/, glyph: 'gear' },
  { test: /avionic|payload|compute/, glyph: 'avionics' },
  { test: /power|battery/, glyph: 'power' },
  { test: /sensor|gimbal|camera/, glyph: 'sensor' },
  { test: /wing/, glyph: 'wing' },
  { test: /boom/, glyph: 'boom' },
  { test: /empennage|tail/, glyph: 'tail' },
  { test: /fuselage|pod/, glyph: 'body' },
  { test: /frame|centre|center|structure/, glyph: 'frame' },
];

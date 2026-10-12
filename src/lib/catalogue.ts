import type { ProductConfig, ProductMetadataFile, SpecEntry } from '../types/product';

// Counted facts shared by the spec matrix, compare and fleet screens so they cannot disagree.
export interface ProductSummary {
  product: ProductConfig;
  metadata: ProductMetadataFile | null;
  structure: SpecEntry[];
  published: SpecEntry[];
  spanM: number | null;
  onWebsite: boolean;
  mtowRange: { min: number; max: number } | null;
  rigCount: number;
}

export function summariseProduct(product: ProductConfig, metadata: ProductMetadataFile | null): ProductSummary {
  const parts = metadata?.parts ?? {};
  const sections = metadata?.sections ?? {};
  const rigParts = Object.values(parts).filter((p) => p.rig);
  const pitchParts = rigParts.filter((p) => p.rig?.pitch);

  const distinctSolids = new Set<string>();
  Object.values(sections).forEach((s) => s.memberNodeKeys.forEach((k) => distinctSolids.add(k)));

  const structure: SpecEntry[] = [
    { label: 'Sections', value: String(Object.keys(sections).length || '—'), provenance: 'measured', note: 'Counted from the authored section map.' },
    { label: 'Solids in sections', value: distinctSolids.size ? distinctSolids.size.toLocaleString() : '—', provenance: 'measured', note: 'Distinct GLB nodes claimed by a section.' },
    { label: 'Documented components', value: String(Object.keys(parts).length), provenance: 'measured', note: 'Parts with authored metadata.' },
    { label: 'Drivable rotor rigs', value: String(rigParts.length), provenance: 'measured', note: 'Components with verified separable hub and spin geometry.' },
    { label: 'Variable-pitch rigs', value: String(pitchParts.length), provenance: 'measured', note: 'Rigs whose blades are separate solids, so a rigid pitch is possible.' },
  ];

  return {
    product,
    metadata,
    structure,
    published: metadata?.website?.keySpecs ?? [],
    spanM: metadata?.physical?.spanM ?? null,
    onWebsite: Boolean(metadata?.website),
    mtowRange: metadata?.website?.mtowKg ?? null,
    rigCount: rigParts.length,
  };
}

// A union, not an intersection, so rows only some products publish still appear.
export function unionSpecLabels(summaries: ProductSummary[]): string[] {
  const seen: string[] = [];
  const set = new Set<string>();
  for (const s of summaries) {
    for (const spec of s.published) {
      if (!set.has(spec.label)) { set.add(spec.label); seen.push(spec.label); }
    }
  }
  return seen;
}

export function findSpec(summary: ProductSummary, label: string): SpecEntry | undefined {
  return summary.published.find((s) => s.label === label);
}

export function formatMtow(range: { min: number; max: number } | null): string {
  return range ? `${range.min}–${range.max} kg` : '—';
}

export function formatSpan(spanM: number | null): string {
  return spanM ? `${spanM.toFixed(2)} m` : '—';
}

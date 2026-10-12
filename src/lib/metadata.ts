import { PropertyBinding } from 'three';
import { SECTION_KEY_PREFIX } from '../constants/products';
import type { PartMetadata, ProductMetadataFile, SectionMetadata } from '../types/product';

// GLTFLoader rewrites names through sanitizeNodeName; authored keys must match the runtime form.
function sanitizeName(name: string): string {
  return PropertyBinding.sanitizeNodeName(name);
}

export function canonicalPartKey(name: string, index: number): string {
  return `${sanitizeName(name)}#${index}`;
}

function normalizeCanonicalKey(key: string): string {
  const hashIdx = key.lastIndexOf('#');
  return hashIdx === -1 ? sanitizeName(key) : `${sanitizeName(key.slice(0, hashIdx))}${key.slice(hashIdx)}`;
}

export function normalizeMetadataParts(parts: Record<string, PartMetadata> | undefined): Record<string, PartMetadata> {
  if (!parts) return {};
  const normalized: Record<string, PartMetadata> = {};
  Object.entries(parts).forEach(([key, value]) => {
    normalized[normalizeCanonicalKey(key)] = value;
  });
  return normalized;
}

export function isSectionKey(key: string): boolean {
  return key.startsWith(SECTION_KEY_PREFIX);
}

export function normalizeMetadataSections(
  sections: Record<string, SectionMetadata> | undefined,
): Record<string, SectionMetadata> {
  if (!sections) return {};
  const normalized: Record<string, SectionMetadata> = {};
  Object.entries(sections).forEach(([id, value]) => {
    if (!isSectionKey(id)) {
      console.warn(`[metadata] section id "${id}" does not start with "${SECTION_KEY_PREFIX}" — it could be confused with a node key.`);
    }
    const memberNodeKeys = value.memberNodeKeys.map((key) => {
      if (!key.includes('#')) {
        console.warn(`[metadata] "${id}": member "${key}" is not a canonical \`name#index\` key and will match no node.`);
      }
      return normalizeCanonicalKey(key);
    });
    normalized[id] = { ...value, memberNodeKeys };
  });
  return normalized;
}

export function buildSectionIndex(sections: Record<string, SectionMetadata>): Record<string, string> {
  const index: Record<string, string> = {};
  Object.entries(sections).forEach(([sectionId, info]) => {
    info.memberNodeKeys.forEach((nodeKey) => {
      if (index[nodeKey] && index[nodeKey] !== sectionId) {
        console.warn(
          `[metadata] node "${nodeKey}" is claimed by both "${index[nodeKey]}" and "${sectionId}" — `
          + 'a solid can only belong to one section.',
        );
      }
      index[nodeKey] = sectionId;
    });
  });
  return index;
}

export type AssemblySelection =
  | { level: 'section'; sectionId: string }
  | { level: 'part'; partKey: string; covered: false };

export function resolveAssemblySelection(
  nodeKey: string,
  sectionIndex: Record<string, string>,
  memberIndex: Record<string, string>,
): AssemblySelection {
  const sectionId = sectionIndex[nodeKey];
  if (sectionId) return { level: 'section', sectionId };
  return { level: 'part', partKey: memberIndex[nodeKey] ?? nodeKey, covered: false };
}

export function resolveMemberSelection(nodeKey: string, memberIndex: Record<string, string>): string {
  return memberIndex[nodeKey] ?? nodeKey;
}

export function rigPartsInSection(
  sectionId: string,
  sections: Record<string, SectionMetadata>,
  parts: Record<string, PartMetadata>,
): string[] {
  const members = new Set(sections[sectionId]?.memberNodeKeys ?? []);
  if (members.size === 0) return [];
  return Object.entries(parts)
    .filter(([partKey, info]) => info.rig && (info.memberNodeKeys ?? [partKey]).every((k) => members.has(k)))
    .map(([partKey]) => partKey);
}

// Checks authored sections against the keys the browser actually loaded. Warns, never throws.
export function reportSectionCoverage(
  runtimeNodeKeys: string[],
  sections: Record<string, SectionMetadata>,
  parts: Record<string, PartMetadata>,
): void {
  if (Object.keys(sections).length === 0) return;

  const real = new Set(runtimeNodeKeys);
  const sectionIndex = buildSectionIndex(sections);

  const unknown = Object.keys(sectionIndex).filter((key) => !real.has(key));
  if (unknown.length) {
    console.warn(
      `[metadata] ${unknown.length} authored section member key(s) match no node in the loaded model — `
      + `the GLB may have been re-exported with different solid ordering. First few: ${unknown.slice(0, 10).join(', ')}`,
    );
  }

  const uncovered = runtimeNodeKeys.filter((key) => !sectionIndex[key]);
  if (uncovered.length) {
    console.warn(
      `[metadata] ${uncovered.length} of ${runtimeNodeKeys.length} solids belong to no section and will select `
      + `individually. First few: ${uncovered.slice(0, 10).join(', ')}`,
    );
  }

  Object.entries(parts).forEach(([partKey, info]) => {
    if (!info.rig) return;
    const owners = new Set<string | undefined>(
      (info.memberNodeKeys ?? [partKey]).map((k) => sectionIndex[k] as string | undefined),
    );
    if (owners.size !== 1 || owners.has(undefined)) {
      console.warn(
        `[metadata] rig "${partKey}" spans ${owners.size} section(s) — RPM CONTROL may be unreachable from `
        + `one of them. Sections: ${[...owners].join(', ')}`,
      );
    }
  });
}

export function buildMemberIndex(parts: Record<string, PartMetadata>): Record<string, string> {
  const index: Record<string, string> = {};
  Object.entries(parts).forEach(([primaryKey, info]) => {
    (info.memberNodeKeys ?? [primaryKey]).forEach((memberKey) => {
      if (index[memberKey] && index[memberKey] !== primaryKey) {
        console.warn(
          `[metadata] canonical key "${memberKey}" is listed as a member of both `
          + `"${index[memberKey]}" and "${primaryKey}" — a part can only belong to one group.`,
        );
      }
      index[memberKey] = primaryKey;
    });
  });
  return index;
}

export function validateRig(primaryKey: string, info: PartMetadata): void {
  if (!info.rig) return;
  const combined = new Set([...info.rig.fixedNodeKeys, ...info.rig.spinningNodeKeys]);
  const members = new Set(info.memberNodeKeys);
  const mismatch = combined.size !== members.size || [...combined].some((k) => !members.has(k));
  if (mismatch) {
    console.warn(
      `[metadata] "${primaryKey}": rig.fixedNodeKeys + rig.spinningNodeKeys does not exactly `
      + `equal memberNodeKeys. fixed+spinning=${[...combined].join(',')} members=${[...members].join(',')}`,
    );
  }
}

export function validatePitch(primaryKey: string, info: PartMetadata): void {
  const pitch = info.rig?.pitch;
  if (!pitch) return;
  const spinning = new Set(info.rig!.spinningNodeKeys);

  const notSpinning = pitch.bladeNodeKeys.filter((k) => !spinning.has(k));
  if (notSpinning.length) {
    console.warn(
      `[metadata] "${primaryKey}": pitch.bladeNodeKeys contains key(s) missing from rig.spinningNodeKeys `
      + `(${notSpinning.join(', ')}). A pitch group is built inside the spin group, so these blades would never move.`,
    );
  }
  if (pitch.bladeNodeKeys.length < 2) {
    console.warn(
      `[metadata] "${primaryKey}": pitch.bladeNodeKeys lists ${pitch.bladeNodeKeys.length} blade(s). `
      + 'Pitch is authored per SEPARATE blade solid — a fused multi-blade solid cannot be pitched rigidly.',
    );
  }
  const members = new Set(info.memberNodeKeys ?? [primaryKey]);
  const orphanHubs = (pitch.hubTravelNodeKeys ?? []).filter((k) => !members.has(k));
  if (orphanHubs.length) {
    console.warn(`[metadata] "${primaryKey}": pitch.hubTravelNodeKeys contains non-member key(s) (${orphanHubs.join(', ')}).`);
  }
}

export async function fetchProductMetadata(url: string): Promise<ProductMetadataFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch metadata: ${url} (${res.status})`);
  const data = (await res.json()) as ProductMetadataFile;
  const parts = normalizeMetadataParts(data.parts);
  Object.entries(parts).forEach(([key, info]) => { validateRig(key, info); validatePitch(key, info); });
  const sections = normalizeMetadataSections(data.sections);
  return { ...data, parts, sections };
}

export function rigSpinsOf(parts: Record<string, PartMetadata> | undefined): { spinningNodeKeys: string[] }[] | null {
  const rigs = Object.values(parts ?? {})
    .filter((p) => p.rig)
    .map((p) => ({ spinningNodeKeys: p.rig!.spinningNodeKeys }));
  return rigs.length > 0 ? rigs : null;
}

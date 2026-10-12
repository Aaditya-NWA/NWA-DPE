import { useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '../constants/system';
import type { ProductMetadataFile } from '../types/product';

// Local, text-only overrides merged over fetched metadata. Never structural, never synced.
export interface TextOverride {
  displayName?: string;
  description?: string;
}

export interface ProductOverride {
  productName?: string;
  parts?: Record<string, TextOverride>;
  sections?: Record<string, TextOverride>;
}

export type OverrideStore = Record<string, ProductOverride>;

function load(): OverrideStore {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.overrides);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OverrideStore) : {};
  } catch (err) {
    console.warn('[overrides] could not read stored overrides; ignoring them', err);
    return {};
  }
}

let current: OverrideStore = load();
const listeners = new Set<() => void>();

function commit(next: OverrideStore) {
  current = next;
  try {
    window.localStorage.setItem(STORAGE_KEYS.overrides, JSON.stringify(current));
  } catch (err) {
    console.warn('[overrides] could not persist overrides', err);
  }
  listeners.forEach((l) => l());
}

export function getOverrides(): OverrideStore {
  return current;
}

export function setTextOverride(
  productId: string,
  scope: 'parts' | 'sections',
  key: string,
  field: keyof TextOverride,
  value: string,
): void {
  const next: OverrideStore = { ...current };
  const product: ProductOverride = { ...(next[productId] ?? {}) };
  const bucket: Record<string, TextOverride> = { ...(product[scope] ?? {}) };
  const entry: TextOverride = { ...(bucket[key] ?? {}) };

  if (value.trim() === '') delete entry[field];
  else entry[field] = value;

  if (Object.keys(entry).length === 0) delete bucket[key];
  else bucket[key] = entry;

  if (Object.keys(bucket).length === 0) delete product[scope];
  else product[scope] = bucket;

  if (Object.keys(product).length === 0) delete next[productId];
  else next[productId] = product;

  commit(next);
}

export function setProductNameOverride(productId: string, value: string): void {
  const next: OverrideStore = { ...current };
  const product: ProductOverride = { ...(next[productId] ?? {}) };
  if (value.trim() === '') delete product.productName;
  else product.productName = value;
  if (Object.keys(product).length === 0) delete next[productId];
  else next[productId] = product;
  commit(next);
}

export function clearProductOverrides(productId: string): void {
  const next = { ...current };
  delete next[productId];
  commit(next);
}

export function clearAllOverrides(): void {
  commit({});
}

export function countOverrides(store: OverrideStore = current): number {
  let n = 0;
  for (const product of Object.values(store)) {
    if (product.productName) n += 1;
    for (const scope of ['parts', 'sections'] as const) {
      for (const entry of Object.values(product[scope] ?? {})) n += Object.keys(entry).length;
    }
  }
  return n;
}

// Returns the original object by reference when nothing applies, so downstream memos keep identity.
export function applyOverrides(productId: string, file: ProductMetadataFile): ProductMetadataFile {
  const override = current[productId];
  if (!override) return file;

  let changed = false;
  const out: ProductMetadataFile = { ...file };

  if (override.productName) {
    out.productName = override.productName;
    changed = true;
  }

  if (override.parts) {
    const parts = { ...file.parts };
    for (const [key, patch] of Object.entries(override.parts)) {
      const base = parts[key];
      if (!base) continue;
      parts[key] = { ...base, ...patch };
      changed = true;
    }
    out.parts = parts;
  }

  if (override.sections && file.sections) {
    const sections = { ...file.sections };
    for (const [key, patch] of Object.entries(override.sections)) {
      const base = sections[key];
      if (!base) continue;
      sections[key] = { ...base, ...patch };
      changed = true;
    }
    out.sections = sections;
  }

  return changed ? out : file;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useOverrides(): OverrideStore {
  return useSyncExternalStore(subscribe, getOverrides, getOverrides);
}

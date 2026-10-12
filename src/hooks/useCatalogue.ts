import { useEffect, useMemo, useState } from 'react';
import { fetchProductMetadata } from '../lib/metadata';
import { applyOverrides, useOverrides } from '../lib/overrides';
import type { ProductConfig, ProductMetadataFile } from '../types/product';

// Every product's metadata loads once at mount; kiosk text overrides merge over it live.
export function useCatalogue(products: ProductConfig[]): Record<string, ProductMetadataFile> {
  const [raw, setRaw] = useState<Record<string, ProductMetadataFile>>({});
  const overrides = useOverrides();

  useEffect(() => {
    let cancelled = false;
    Promise.all(products.map((p) => fetchProductMetadata(p.metadataUrl)
      .then((data) => [p.id, data] as const)
      .catch((err) => {
        console.error(`[App] metadata load failed for "${p.id}"`, err);
        return null;
      })))
      .then((rows) => {
        if (cancelled) return;
        setRaw(Object.fromEntries(rows.filter((r): r is readonly [string, ProductMetadataFile] => r !== null)));
      });
    return () => { cancelled = true; };
  }, [products]);

  return useMemo(() => {
    const out: Record<string, ProductMetadataFile> = {};
    for (const [id, file] of Object.entries(raw)) out[id] = applyOverrides(id, file);
    return out;
    // `overrides` is the store snapshot applyOverrides reads internally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw, overrides]);
}

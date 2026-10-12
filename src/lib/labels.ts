import { LABELS } from '../constants/viewer';
import type { PartMetadata } from '../types/product';

// One label per authored component (not per solid), on its primary key where visible.
export function buildExplodeLabels(
  candidateKeys: Iterable<string>,
  visible: Set<string> | null,
  memberIndex: Record<string, string>,
  parts: Record<string, PartMetadata> | undefined,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  const labelled = new Set<string>();
  for (const key of candidateKeys) {
    const primary = memberIndex[key] ?? key;
    const name = parts?.[primary]?.displayName;
    if (!name || labelled.has(primary)) continue;
    labelled.add(primary);
    out[visible && !visible.has(primary) ? key : primary] = name;
  }
  const count = Object.keys(out).length;
  if (count === 0) return null;
  if (count > LABELS.limit) {
    console.warn(
      `[App] explode labels suppressed: ${count} authored components in view exceeds the `
      + `readable limit of ${LABELS.limit}. Isolate a section to label its parts.`,
    );
    return null;
  }
  return out;
}

// Measured footprints of the floating panels, so chips never land beneath them.
export function labelInsetFor(telemetryUp: boolean, infoUp: boolean) {
  const { top, bottom, edge, telemetry, info } = LABELS.inset;
  return {
    top,
    right: edge + (telemetryUp ? telemetry : 0),
    bottom,
    left: edge + (infoUp ? info : 0),
  };
}

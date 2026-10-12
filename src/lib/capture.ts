import { CAPTURE } from '../constants/system';

// Requires the Canvas to be created with preserveDrawingBuffer: true (see Viewer).
export interface CaptionFields {
  productLabel: string;
  selectionLabel?: string;
  screenLabel: string;
  backgroundColor?: string;
}

export interface CaptureResult {
  canvas: HTMLCanvasElement;
  dataUrl: string;
  filename: string;
}

function filename(fields: CaptionFields): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = [fields.productLabel, fields.selectionLabel]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, CAPTURE.slugMaxLength);
  return `nwa-dpe-${slug || 'viewport'}-${stamp}.png`;
}

export function composeCapture(source: HTMLCanvasElement, fields: CaptionFields): HTMLCanvasElement | null {
  const { width, height } = source;
  if (width === 0 || height === 0) {
    console.warn('[capture] source canvas has zero size; nothing to capture');
    return null;
  }

  const out = document.createElement('canvas');
  out.width = width;
  out.height = height + CAPTURE.captionHeight;
  const ctx = out.getContext('2d');
  if (!ctx) {
    console.warn('[capture] could not get a 2D context for the output canvas');
    return null;
  }

  ctx.fillStyle = fields.backgroundColor ?? CAPTURE.fallbackBackground;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0);

  const scale = Math.max(1, width / (source.clientWidth || width));

  ctx.fillStyle = CAPTURE.stripBackground;
  ctx.fillRect(0, height, out.width, CAPTURE.captionHeight);
  ctx.fillStyle = CAPTURE.stripAccent;
  ctx.fillRect(0, height, out.width, 3 * scale);

  const pad = 22 * scale;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = CAPTURE.title;
  ctx.font = `700 ${19 * scale}px ${CAPTURE.font}`;
  ctx.fillText(fields.productLabel, pad, height + 34 * scale);

  ctx.fillStyle = CAPTURE.body;
  ctx.font = `${13 * scale}px ${CAPTURE.font}`;
  ctx.fillText(fields.selectionLabel ?? 'Complete assembly', pad, height + 56 * scale);

  ctx.fillStyle = CAPTURE.meta;
  ctx.font = `${11 * scale}px ${CAPTURE.monoFont}`;
  const meta = `${fields.screenLabel} · ${new Date().toLocaleString()}`;
  ctx.fillText(meta, out.width - pad - ctx.measureText(meta).width, height + 34 * scale);
  ctx.fillText(CAPTURE.brand, out.width - pad - ctx.measureText(CAPTURE.brand).width, height + 56 * scale);

  return out;
}

// False for a working capture; true when preserveDrawingBuffer was lost and the buffer reads back empty.
function looksBlank(source: HTMLCanvasElement): boolean {
  const probe = document.createElement('canvas');
  probe.width = CAPTURE.probeSize;
  probe.height = CAPTURE.probeSize;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(source, 0, 0, CAPTURE.probeSize, CAPTURE.probeSize);
  const { data } = ctx.getImageData(0, 0, CAPTURE.probeSize, CAPTURE.probeSize);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false;
  }
  return true;
}

export function captureViewport(container: HTMLElement | null, fields: CaptionFields): CaptureResult | null {
  const source = container?.querySelector('canvas');
  if (!source) {
    console.warn('[capture] no canvas found in the viewport container');
    return null;
  }
  if (looksBlank(source)) {
    console.error(
      '[capture] the WebGL drawing buffer read back empty. This almost always means the Canvas '
      + 'was created without `preserveDrawingBuffer: true` — see components/engine/Viewer.tsx.',
    );
    return null;
  }
  const canvas = composeCapture(source, fields);
  if (!canvas) return null;
  return { canvas, dataUrl: canvas.toDataURL('image/png'), filename: filename(fields) };
}

export function downloadCapture(result: CaptureResult): void {
  const link = document.createElement('a');
  link.href = result.dataUrl;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

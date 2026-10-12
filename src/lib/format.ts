export function onOff(value: boolean): string {
  return value ? 'ON' : 'OFF';
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 'S'}`;
}

export function formatLength(metres: number): string {
  if (metres >= 1) return `${metres.toFixed(metres >= 10 ? 0 : 2)} m`;
  return `${Math.round(metres * 100)} cm`;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

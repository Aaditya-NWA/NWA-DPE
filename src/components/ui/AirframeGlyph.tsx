import { theme } from '../../constants/theme';
import type { AirframeSilhouette } from '../../types/product';

const CX = 100;
const CY = 60;

function armEnds(count: number, radius: number, offsetDeg: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((offsetDeg + (360 / count) * i) * Math.PI) / 180;
    return { x: CX + Math.cos(a) * radius, y: CY + Math.sin(a) * radius * 0.82 };
  });
}

function Multirotor({ arms, offset, coaxial = false }: { arms: number; offset: number; coaxial?: boolean }) {
  const ends = armEnds(arms, 44, offset);
  return (
    <>
      {ends.map((p, i) => <line key={`a${i}`} x1={CX} y1={CY} x2={p.x} y2={p.y} strokeWidth={2.2} />)}
      {ends.map((p, i) => (
        <g key={`r${i}`}>
          <circle cx={p.x} cy={p.y} r={15} fill={theme.color.accentGlow} strokeWidth={1.2} />
          {coaxial && <circle cx={p.x} cy={p.y} r={9} strokeWidth={1} strokeDasharray="2 2" />}
          <circle cx={p.x} cy={p.y} r={2.2} fill={theme.color.accentBright} stroke="none" />
        </g>
      ))}
      <rect x={CX - 11} y={CY - 9} width={22} height={18} rx={4} fill={theme.color.surface} strokeWidth={1.6} />
    </>
  );
}

function Vtol() {
  const rotors = [[64, 34], [136, 34], [64, 86], [136, 86]];
  return (
    <>
      <path d="M40 60 L160 60" strokeWidth={1.4} opacity={0.4} />
      <path d="M100 18 L100 104" strokeWidth={5} strokeLinecap="round" />
      <path d="M30 56 L170 56 L170 64 L30 64 Z" fill={theme.color.surface} strokeWidth={1.4} />
      <path d="M84 100 L116 100" strokeWidth={3} strokeLinecap="round" />
      <path d="M64 22 L64 98 M136 22 L136 98" strokeWidth={1.6} />
      {rotors.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r={12} fill={theme.color.accentGlow} strokeWidth={1.2} />
          <circle cx={x} cy={y} r={2} fill={theme.color.accentBright} stroke="none" />
        </g>
      ))}
      <path d="M92 110 L108 110" strokeWidth={2.4} strokeLinecap="round" stroke={theme.color.accentBright} />
    </>
  );
}

export default function AirframeGlyph({ silhouette, height = 120 }: { silhouette: AirframeSilhouette; height?: number }) {
  return (
    <svg
      viewBox="0 0 200 120"
      height={height}
      style={{ display: 'block', maxWidth: '100%' }}
      fill="none"
      stroke={theme.color.accent}
      strokeLinecap="round"
      aria-hidden
    >
      {silhouette === 'quad' && <Multirotor arms={4} offset={45} />}
      {silhouette === 'hex' && <Multirotor arms={6} offset={0} />}
      {silhouette === 'coaxial-octo' && <Multirotor arms={4} offset={45} coaxial />}
      {silhouette === 'vtol' && <Vtol />}
    </svg>
  );
}

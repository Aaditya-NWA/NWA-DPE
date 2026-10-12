import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../../constants/theme';

export function Pill({ children, tone = theme.color.accent }: { children: ReactNode; tone?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content',
      background: theme.color.accentGlow, border: `1px solid ${theme.color.accentSoft}`,
      borderRadius: theme.radius.pill, padding: '5px 13px',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: tone, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 500, color: tone, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  );
}

export function Accent({ children }: { children: ReactNode }) {
  return <span style={{ color: theme.color.accent }}>{children}</span>;
}

export function SectionHeading({ pill, title, body, align = 'left', size = 'lg', style }: {
  pill: string;
  title: ReactNode;
  body?: ReactNode;
  align?: 'left' | 'center';
  size?: 'lg' | 'md';
  style?: CSSProperties;
}) {
  const center = align === 'center';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: center ? 'center' : 'flex-start', textAlign: align, ...style }}>
      <Pill>{pill}</Pill>
      <h2 style={{
        fontWeight: 700,
        fontSize: size === 'lg' ? 'clamp(28px, 3.2vw, 42px)' : 'clamp(22px, 2.5vw, 32px)',
        lineHeight: 1.15, color: theme.color.text, margin: '16px 0 12px', letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      {body && (
        <p style={{ fontSize: 15, lineHeight: 1.7, color: theme.color.textSub, margin: 0, maxWidth: 640 }}>
          {body}
        </p>
      )}
    </div>
  );
}

export function DotGrid({ opacity = 1 }: { opacity?: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', opacity,
      backgroundImage: theme.gradient.dotGrid, backgroundSize: theme.dotGridSize,
    }} />
  );
}

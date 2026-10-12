import type { CSSProperties } from 'react';
import { theme } from '../constants/theme';
import type { Provenance } from '../types/product';

const { color, radius, font, touchTarget } = theme;

export const eyebrowStyle: CSSProperties = {
  fontFamily: font.ui,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: color.accent,
};

export const microLabelStyle: CSSProperties = {
  fontFamily: font.ui,
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: color.textMuted,
};

export const monoStyle: CSSProperties = {
  fontFamily: font.mono,
  fontVariantNumeric: 'tabular-nums',
};

export function chromeButtonStyle(active: boolean): CSSProperties {
  return {
    minHeight: touchTarget,
    padding: '0 16px',
    fontFamily: font.ui,
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.06em',
    background: active ? color.accent : color.glass,
    color: active ? color.textOnAccent : color.textSub,
    border: `1px solid ${active ? color.accent : color.border}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    backdropFilter: theme.blur,
    boxShadow: active ? theme.shadow.accent : '0 4px 14px rgba(0, 0, 0, 0.35)',
    transition: 'background 180ms, color 180ms, border-color 180ms',
  };
}

export function primaryButtonStyle(): CSSProperties {
  return {
    minHeight: touchTarget,
    padding: '0 22px',
    fontFamily: font.ui,
    fontSize: 14,
    fontWeight: 600,
    color: color.textOnAccent,
    background: color.accent,
    border: 'none',
    borderRadius: radius.md,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'background 200ms, transform 200ms',
  };
}

export function secondaryButtonStyle(): CSSProperties {
  return {
    minHeight: touchTarget,
    padding: '0 18px',
    fontFamily: font.ui,
    fontSize: 13.5,
    fontWeight: 600,
    color: color.textSub,
    background: 'transparent',
    border: `1px solid ${color.border}`,
    borderRadius: radius.md,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'color 200ms, border-color 200ms, transform 200ms',
  };
}

export function overlayPanelStyle(): CSSProperties {
  return {
    background: color.glass,
    border: theme.hairline,
    borderRadius: radius.lg,
    boxShadow: theme.shadow.panel,
    backdropFilter: theme.blur,
    color: color.text,
  };
}

export function cardStyle(): CSSProperties {
  return {
    background: color.card,
    border: theme.hairline,
    borderRadius: radius.xl,
    overflow: 'hidden',
  };
}

export function inputStyle(invalid = false): CSSProperties {
  return {
    width: '100%',
    minHeight: touchTarget,
    padding: '0 16px',
    fontFamily: font.ui,
    fontSize: 14.5,
    color: color.text,
    background: color.surface,
    border: `1px solid ${invalid ? color.danger : color.border}`,
    borderRadius: radius.md,
    outline: 'none',
    transition: 'border-color 150ms',
  };
}

export function provenanceBadgeStyle(provenance: Provenance): CSSProperties {
  const measured = provenance === 'measured';
  const tone = measured ? color.measured : color.placeholder;
  return {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontFamily: font.ui,
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.1em',
    lineHeight: 1.7,
    whiteSpace: 'nowrap',
    color: tone,
    background: measured ? color.measuredBg : color.placeholderBg,
    border: `1px solid ${tone}40`,
  };
}

export const dividerStyle: CSSProperties = { height: 1, background: color.border, margin: '4px 0' };

export const pageContainerStyle = (maxWidth = 1280): CSSProperties => ({
  maxWidth,
  margin: '0 auto',
  padding: '0 40px',
});

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { theme } from '../../constants/theme';
import { chromeButtonStyle, primaryButtonStyle, secondaryButtonStyle } from '../../styles/primitives';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function PrimaryButton({ children, style, className, ...rest }: ButtonProps) {
  return (
    <button {...rest} className={`nw-btn-primary ${className ?? ''}`} style={{ ...primaryButtonStyle(), ...style }}>
      {children}
    </button>
  );
}

export function GhostButton({ children, style, className, ...rest }: ButtonProps) {
  return (
    <button {...rest} className={`nw-btn-ghost ${className ?? ''}`} style={{ ...secondaryButtonStyle(), ...style }}>
      {children}
    </button>
  );
}

export function ChromeButton({ active = false, label, state, style, ...rest }: Omit<ButtonProps, 'children'> & {
  active?: boolean;
  label: ReactNode;
  state?: string;
}) {
  const stateStyle: CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.1em',
    padding: '2px 6px',
    borderRadius: 6,
    background: active ? 'rgba(2, 8, 20, 0.16)' : theme.color.surfaceAlt,
    color: active ? theme.color.textOnAccent : theme.color.textMuted,
  };
  return (
    <button
      {...rest}
      aria-pressed={state !== undefined ? active : undefined}
      className="nw-chrome"
      style={{ ...chromeButtonStyle(active), display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}
    >
      <span>{label}</span>
      {state !== undefined && <span style={stateStyle}>{state}</span>}
    </button>
  );
}

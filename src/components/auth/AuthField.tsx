import { useState } from 'react';
import type { ReactNode } from 'react';
import { theme } from '../../constants/theme';

export default function AuthField({ id, label, type, autoComplete, value, onChange, placeholder, error, suffix }: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error: string | null;
  suffix?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const tone = error ? theme.color.danger : focused ? theme.color.accent : undefined;

  return (
    <div style={{ marginBottom: 16 }}>
      <label
        htmlFor={id}
        style={{
          display: 'block', fontSize: 12, fontWeight: 500, letterSpacing: '0.02em', marginBottom: 7,
          color: tone ?? theme.color.textSub, transition: 'color 150ms',
        }}
      >
        {label}
      </label>
      <div style={{
        display: 'flex', alignItems: 'center', overflow: 'hidden',
        background: theme.color.surface, borderRadius: theme.radius.md,
        border: `1px solid ${tone ?? theme.color.border}`, transition: 'border-color 150ms',
      }}>
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{
            flex: 1, minWidth: 0, minHeight: theme.touchTarget + 4, padding: '0 16px',
            background: 'none', border: 'none', outline: 'none',
            fontSize: 14.5, color: theme.color.text,
          }}
        />
        {suffix && <div style={{ paddingRight: 12, display: 'flex' }}>{suffix}</div>}
      </div>
      {error && (
        <div id={`${id}-error`} style={{ marginTop: 6, fontSize: 12, color: theme.color.danger }}>{error}</div>
      )}
    </div>
  );
}

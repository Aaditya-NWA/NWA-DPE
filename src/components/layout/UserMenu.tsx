import { useEffect, useRef, useState } from 'react';
import { theme } from '../../constants/theme';
import { microLabelStyle } from '../../styles/primitives';
import { sessionInitials } from '../../lib/session';

export default function UserMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Session menu"
        aria-expanded={open}
        style={{
          width: 40, height: 40, borderRadius: '50%', cursor: 'pointer',
          background: theme.gradient.brand, color: theme.color.textOnAccent,
          border: `2px solid ${open ? theme.color.accent : theme.color.border}`,
          fontWeight: 700, fontSize: 13, transition: 'border-color 200ms',
        }}
      >
        {sessionInitials(email)}
      </button>

      {open && (
        <div
          className="nw-fade-up"
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, zIndex: 100, minWidth: 240,
            background: theme.color.surface, border: theme.hairline, borderRadius: 12,
            boxShadow: theme.shadow.panel, overflow: 'hidden',
          }}
        >
          <div style={{ padding: '16px 20px 12px' }}>
            <div style={{ ...microLabelStyle, fontSize: 9.5, marginBottom: 6 }}>Signed in · demo session</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.color.text, wordBreak: 'break-all' }}>{email}</div>
          </div>
          <div style={{ borderTop: theme.hairline, padding: '6px 0' }}>
            <button
              className="nw-danger"
              onClick={() => { setOpen(false); onSignOut(); }}
              style={{
                width: '100%', textAlign: 'left', padding: '11px 20px', background: 'none', border: 'none',
                fontSize: 14, color: theme.color.danger, cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

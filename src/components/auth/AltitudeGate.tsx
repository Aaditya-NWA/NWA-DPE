import { useState } from 'react';
import type { FormEvent } from 'react';
import { theme } from '../../constants/theme';
import { GATE_COPY, IMAGES } from '../../constants/content';
import { eyebrowStyle } from '../../styles/primitives';
import { signIn, SignInError } from '../../lib/session';
import type { MockSession } from '../../lib/session';
import { BrandLockup } from '../ui/Brand';
import { GhostButton, PrimaryButton } from '../ui/Buttons';
import { Accent, DotGrid } from '../ui/Typography';
import { EyeGlyph, Spinner } from '../ui/Glyphs';
import AuthField from './AuthField';

// The 3,000 m gate. A demonstration seam over a local mock — says so plainly, enforces nothing.
export default function AltitudeGate({ gateAltitudeM, ceilingM, productLabel, onSignedIn, onDismiss }: {
  gateAltitudeM: number;
  ceilingM: number;
  productLabel: string;
  onSignedIn: (session: MockSession) => void;
  onDismiss: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<SignInError | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    signIn(email, password)
      .then(onSignedIn)
      .catch((err: unknown) => {
        if (err instanceof SignInError) setError(err);
        else console.error('[AltitudeGate] unexpected sign-in failure', err);
      })
      .finally(() => setPending(false));
  }

  const gate = gateAltitudeM.toLocaleString();
  const stats = [
    { value: `${gate} m`, label: 'Gate altitude' },
    { value: `${ceilingM.toLocaleString()} m`, label: 'Full ceiling' },
    { value: `+${Math.max(0, ceilingM - gateAltitudeM).toLocaleString()} m`, label: 'Unlocked' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
      style={{
        position: 'absolute', inset: 0, zIndex: 10, padding: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(1, 6, 16, 0.72)', backdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="nw-split nw-fade-up"
        style={{
          width: '100%', maxWidth: 900, maxHeight: '100%', overflow: 'hidden',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: theme.color.page, border: theme.hairline, borderRadius: 20,
          boxShadow: '0 30px 90px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(89, 162, 184, 0.08)',
        }}
      >
        <div
          className="nw-split-visual nw-hide-narrow"
          style={{ position: 'relative', overflow: 'hidden', minHeight: 520, padding: '34px 36px', display: 'flex', flexDirection: 'column' }}
        >
          <img
            src={IMAGES.cockpit}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.22) saturate(0.55)' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 30% 80%, rgba(89,162,184,0.14) 0%, transparent 70%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 55%, ${theme.color.page} 100%)` }} />
          <DotGrid />

          <div style={{ position: 'relative' }}><BrandLockup subtitle={false} /></div>

          <div style={{ position: 'relative', marginTop: 'auto' }}>
            <div style={{ ...eyebrowStyle, marginBottom: 14 }}>{GATE_COPY.visualLabel} · {productLabel}</div>
            <h2 style={{ fontSize: 'clamp(26px, 2.6vw, 36px)', fontWeight: 700, lineHeight: 1.15, color: theme.color.text, margin: '0 0 12px' }}>
              {GATE_COPY.visualTitleLead}<br /><Accent>{GATE_COPY.visualTitleAccent}</Accent>
            </h2>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: theme.color.textSub, margin: '0 0 26px', maxWidth: 320 }}>
              Flight above {gate} m {GATE_COPY.visualBody}
            </p>
            <div style={{ display: 'flex', gap: 28, paddingTop: 22, borderTop: theme.hairline }}>
              {stats.map((s) => (
                <div key={s.label}>
                  <div style={{ fontWeight: 700, fontSize: 19, color: theme.color.text }}>{s.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: theme.color.textMuted, marginTop: 3, letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '40px 40px 36px', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ ...eyebrowStyle, marginBottom: 10 }}>{GATE_COPY.formLabel}</div>
          <h1 id="gate-title" style={{ fontSize: 'clamp(24px, 2.4vw, 30px)', fontWeight: 700, lineHeight: 1.2, color: theme.color.text, margin: '0 0 16px' }}>
            {GATE_COPY.formTitleLead}<br /><Accent>{GATE_COPY.formTitleAccent}</Accent>
          </h1>
          <p style={{
            margin: '0 0 24px', padding: '10px 12px', borderRadius: theme.radius.md, fontSize: 12, lineHeight: 1.55,
            color: theme.color.textSub, background: theme.color.placeholderBg, border: `1px solid ${theme.color.placeholder}33`,
          }}>
            {GATE_COPY.demoNotice}
          </p>

          <form onSubmit={handleSubmit} noValidate>
            <AuthField
              id="gate-email"
              label="Email address"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder={GATE_COPY.emailPlaceholder}
              error={error?.field === 'email' ? error.message : null}
            />
            <AuthField
              id="gate-password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              placeholder={GATE_COPY.passwordPlaceholder}
              error={error?.field === 'password' ? error.message : null}
              suffix={(
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: theme.color.textMuted, display: 'flex' }}
                >
                  <EyeGlyph open={showPassword} />
                </button>
              )}
            />

            <PrimaryButton
              type="submit"
              disabled={pending}
              style={{
                width: '100%', marginTop: 8, minHeight: theme.touchTarget + 4,
                background: pending ? theme.color.accentGlow : theme.color.accent,
                color: pending ? theme.color.accentBright : theme.color.textOnAccent,
                cursor: pending ? 'progress' : 'pointer',
              }}
            >
              {pending ? <><Spinner /> Authenticating…</> : 'Sign in'}
            </PrimaryButton>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: theme.color.border }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: theme.color.textDim, letterSpacing: '0.1em' }}>OR</span>
            <div style={{ flex: 1, height: 1, background: theme.color.border }} />
          </div>

          <GhostButton type="button" onClick={onDismiss} style={{ width: '100%', minHeight: theme.touchTarget + 4 }}>
            Stay below {gate} m
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

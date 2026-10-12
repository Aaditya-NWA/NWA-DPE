import { theme } from '../../constants/theme';
import { BRAND } from '../../constants/content';

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.22, flexShrink: 0,
      background: theme.gradient.brand,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 14 14" fill="none" aria-hidden>
        <path d="M2 12L7 2l5 10H2z" fill="white" fillOpacity="0.92" />
      </svg>
    </span>
  );
}

export function BrandLockup({ subtitle = true }: { subtitle?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <BrandMark />
      <div style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.04em', color: theme.color.text, whiteSpace: 'nowrap' }}>
          {BRAND.name}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 9.5, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: theme.color.textMuted, whiteSpace: 'nowrap',
          }}>
            {BRAND.product}
          </div>
        )}
      </div>
    </div>
  );
}

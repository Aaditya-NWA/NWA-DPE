import type { ReactNode } from 'react';
import { theme } from '../../constants/theme';
import { eyebrowStyle, overlayPanelStyle } from '../../styles/primitives';
import { PrimaryButton } from '../ui/Buttons';
import { SpecList } from '../ui/Controls';
import type { SpecEntry } from '../../types/product';

const TOP = 24 + theme.touchTarget + 16;

export default function InfoPanel({ title, description, onInDepth, tag, specs, children }: {
  title: string;
  description: string;
  onInDepth?: () => void;
  tag?: string;
  specs?: SpecEntry[];
  children?: ReactNode;
}) {
  return (
    <div
      className="nw-fade-up"
      style={{
        ...overlayPanelStyle(),
        position: 'absolute', top: TOP, left: 24, maxWidth: 340,
        maxHeight: `calc(100% - ${TOP + 24}px)`, overflowY: 'auto',
        padding: '20px 22px 22px', fontSize: 13.5,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 22, right: 22, height: 2, background: theme.gradient.brand, borderRadius: 2 }} />
      {tag && <div style={{ ...eyebrowStyle, fontSize: 10.5, marginBottom: 10 }}>{tag}</div>}
      <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: theme.color.text, letterSpacing: '-0.01em' }}>
        {title}
      </div>
      <div style={{ color: theme.color.textSub, lineHeight: 1.6 }}>{description}</div>
      {specs && specs.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: theme.hairline }}>
          <SpecList specs={specs} />
        </div>
      )}
      {children}
      {onInDepth && (
        <PrimaryButton onClick={onInDepth} style={{ width: '100%', marginTop: 18 }}>
          Detailed View →
        </PrimaryButton>
      )}
    </div>
  );
}

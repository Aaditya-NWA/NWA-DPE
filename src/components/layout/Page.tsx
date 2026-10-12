import type { CSSProperties, ReactNode } from 'react';
import { pageContainerStyle } from '../../styles/primitives';

export function PageScroll({ children }: { children: ReactNode }) {
  return (
    <div className="nw-fade-up" style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
      {children}
    </div>
  );
}

export function PageSection({ children, maxWidth, style }: { children: ReactNode; maxWidth?: number; style?: CSSProperties }) {
  return (
    <section style={style}>
      <div style={pageContainerStyle(maxWidth)}>{children}</div>
    </section>
  );
}

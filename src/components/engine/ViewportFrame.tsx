import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../../constants/theme';
import ErrorBoundary from './ErrorBoundary';

const BRACKET = 26;
const EDGE = `2px solid ${theme.color.accent}`;
const CORNERS: CSSProperties[] = [
  { top: 14, left: 14, borderTop: EDGE, borderLeft: EDGE },
  { top: 14, right: 14, borderTop: EDGE, borderRight: EDGE },
  { bottom: 14, left: 14, borderBottom: EDGE, borderLeft: EDGE },
  { bottom: 14, right: 14, borderBottom: EDGE, borderRight: EDGE },
];

// Single chokepoint guarding every inspection viewport; brackets stay outside the boundary.
export default function ViewportFrame({ children, resetKey, onRetry }: {
  children: ReactNode;
  resetKey?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ErrorBoundary resetKey={resetKey} onRetry={onRetry}>{children}</ErrorBoundary>
      {CORNERS.map((corner, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', width: BRACKET, height: BRACKET,
            pointerEvents: 'none', opacity: 0.7, borderRadius: 2, ...corner,
          }}
        />
      ))}
    </div>
  );
}

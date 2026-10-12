import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { theme } from '../../constants/theme';
import { eyebrowStyle, monoStyle, primaryButtonStyle } from '../../styles/primitives';

interface Props {
  children: ReactNode;
  resetKey?: string;
  onRetry?: () => void;
}

interface State {
  error: Error | null;
  lastResetKey?: string;
}

// Class component: React has no hook equivalent of componentDidCatch.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): Pick<State, 'error'> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): State | null {
    if (props.resetKey === state.lastResetKey) return null;
    return { error: null, lastResetKey: props.resetKey };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] viewport subtree failed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        data-testid="viewport-error"
        style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32,
          background: theme.color.pageDeep, textAlign: 'center',
        }}
      >
        <div style={{ ...eyebrowStyle, color: theme.color.danger }}>Model load error</div>
        <div style={{ fontSize: 18, fontWeight: 600, color: theme.color.text, maxWidth: 460 }}>
          Failed to load model — check the asset path.
        </div>
        <div style={{ fontSize: 13.5, color: theme.color.textSub, maxWidth: 460, lineHeight: 1.6 }}>
          Use the navigation above to return to the product list. The rest of the application is unaffected.
        </div>
        {this.props.onRetry && (
          <button className="nw-btn-primary" onClick={this.props.onRetry} style={{ ...primaryButtonStyle(), marginTop: 6 }}>
            Retry
          </button>
        )}
        <div style={{
          ...monoStyle, marginTop: 10, padding: '8px 12px', maxWidth: 560, borderRadius: theme.radius.md,
          background: theme.color.surface, border: theme.hairline, fontSize: 10.5,
          color: theme.color.textMuted, wordBreak: 'break-word',
        }}>
          {error.message}
        </div>
      </div>
    );
  }
}

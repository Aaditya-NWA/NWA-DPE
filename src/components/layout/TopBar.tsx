import { theme } from '../../constants/theme';
import { useFullscreen } from '../../lib/fullscreen';
import { buildCrumbs } from '../../lib/navigation';
import { BrandLockup } from '../ui/Brand';
import SectionIcon from '../inspection/SectionIcon';
import UserMenu from './UserMenu';
import { FullscreenGlyph, GearGlyph } from '../ui/Glyphs';
import type { ViewMode } from '../../types/product';

const headerButton = (active = false) => ({
  minHeight: 40,
  padding: '0 14px',
  cursor: 'pointer',
  fontSize: 12.5,
  fontWeight: 500,
  color: active ? theme.color.textOnAccent : theme.color.textSub,
  background: active ? theme.color.accent : 'transparent',
  border: `1px solid ${active ? theme.color.accent : theme.color.border}`,
  borderRadius: theme.radius.md,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  transition: 'color 180ms, border-color 180ms',
});

export default function TopBar({
  view,
  onExit,
  productLabel,
  detailLabel,
  sessionEmail,
  onSignOut,
  onOpenSettings,
  gamepadId,
}: {
  view: ViewMode;
  onExit: (v: ViewMode) => void;
  productLabel?: string;
  detailLabel?: string;
  sessionEmail?: string | null;
  onSignOut?: () => void;
  onOpenSettings?: () => void;
  gamepadId?: string | null;
}) {
  const fullscreen = useFullscreen();
  const crumbs = buildCrumbs(view, productLabel, detailLabel);
  const websiteFlow = view.screen === 'showcase' || view.screen === 'fly';

  return (
    <header style={{
      position: 'relative', zIndex: 40, flexShrink: 0,
      minHeight: theme.headerHeight, padding: '0 28px',
      display: 'flex', alignItems: 'center', gap: 24,
      background: theme.color.header, backdropFilter: 'blur(20px)',
      borderBottom: theme.hairline,
    }}>
      <button
        onClick={() => onExit({ screen: 'entry' })}
        disabled={view.screen === 'entry'}
        aria-label="Home"
        style={{ background: 'none', border: 'none', padding: 0, cursor: view.screen === 'entry' ? 'default' : 'pointer' }}
      >
        <BrandLockup />
      </button>

      <div style={{ width: 1, alignSelf: 'stretch', margin: '20px 0', background: theme.color.border }} />

      <nav style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        {crumbs.map((c, i) => {
          const isCurrent = i === crumbs.length - 1;
          return (
            <span key={`${c.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {i > 0 && <span style={{ color: theme.color.textDim, fontSize: 14 }}>›</span>}
              <button
                className={isCurrent ? undefined : 'nw-link'}
                onClick={() => onExit(c.target)}
                disabled={isCurrent}
                style={{
                  background: isCurrent ? theme.color.accentGlow : 'none',
                  border: `1px solid ${isCurrent ? theme.color.accentSoft : 'transparent'}`,
                  borderRadius: theme.radius.pill,
                  padding: '7px 12px',
                  cursor: isCurrent ? 'default' : 'pointer',
                  fontSize: 13.5, fontWeight: 500, letterSpacing: '0.01em',
                  color: isCurrent ? theme.color.accentBright : theme.color.textSub,
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  transition: 'color 180ms',
                }}
              >
                {c.sectionId && (
                  <SectionIcon sectionId={c.sectionId} size={14} color={isCurrent ? theme.color.accentBright : theme.color.textMuted} />
                )}
                {c.label}
              </button>
            </span>
          );
        })}
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        {gamepadId && (
          <span
            title={gamepadId}
            style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
              color: theme.color.measured, background: theme.color.measuredBg,
              border: `1px solid ${theme.color.measured}40`, borderRadius: theme.radius.pill,
              padding: '4px 10px', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
          >
            PANEL CONNECTED
          </span>
        )}

        {fullscreen.supported && (
          <button
            className={fullscreen.active ? undefined : 'nw-btn-ghost'}
            onClick={fullscreen.toggle}
            aria-pressed={fullscreen.active}
            title={fullscreen.active ? 'Leave full screen (Esc)' : 'Fill the display, hiding the browser'}
            style={headerButton(fullscreen.active)}
          >
            <FullscreenGlyph exiting={fullscreen.active} />
            <span className="nw-hide-narrow">{fullscreen.active ? 'Exit full screen' : 'Full screen'}</span>
          </button>
        )}

        {onOpenSettings && (
          <button className="nw-btn-ghost" onClick={onOpenSettings} aria-label="Kiosk settings" style={headerButton()}>
            <GearGlyph />
            <span className="nw-hide-narrow">Settings</span>
          </button>
        )}

        {websiteFlow && sessionEmail && onSignOut && <UserMenu email={sessionEmail} onSignOut={onSignOut} />}
      </div>
    </header>
  );
}

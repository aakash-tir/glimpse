import type { CSSProperties } from 'react';
import type { Settings } from '../../../shared/settings-store';

// First-launch prompt nudging the user to set their location manually.
// Shows once when settings.locationPermissionAsked === false (gated by
// the parent — WindowView renders this null when the flag is true).
//
// Why this exists: IP geolocation puts users at the centroid of their
// ISP's allocation, which in mountainous / rural areas can be ~10 km
// off and several hundred metres of elevation away — wildly wrong
// temperatures result. The prompt explains the issue in one sentence
// and offers two paths:
//   "Set location" → flips advancedLocationEnabled to true so the
//     user lands in Settings with the form pre-expanded; they type
//     their city and Open-Meteo geocodes it.
//   "Maybe later" → just dismisses; user can come back later via
//     Settings → Advanced location.
//
// Either path sets locationPermissionAsked = true so the prompt
// doesn't reappear next launch.

export type LocationPromptProps = {
  settings: Settings | null;
};

export function LocationPrompt({
  settings,
}: LocationPromptProps): JSX.Element | null {
  // Wait for settings to load — null while the initial getSettings()
  // promise is in flight. Don't show the prompt during that brief
  // window: we don't yet know whether the flag is already set.
  if (!settings) return null;
  if (settings.locationPermissionAsked) return null;

  const handleSetLocation = (): void => {
    void window.glimpse?.setSettings({
      advancedLocationEnabled: true,
      locationPermissionAsked: true,
    });
  };

  const handleMaybeLater = (): void => {
    void window.glimpse?.setSettings({
      locationPermissionAsked: true,
    });
  };

  return (
    <div
      data-testid="location-prompt"
      // Stop propagation so panel-level double-clicks (window-drag
      // gesture in WindowView) don't fire while the prompt is open.
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={overlayStyle}
    >
      <div data-testid="location-prompt-card" style={cardStyle}>
        <span data-testid="location-prompt-title" style={titleStyle}>
          Set your location?
        </span>
        <span style={bodyStyle}>
          Glimpse uses your IP address for location, which can be off by several
          km in mountains or rural areas. Set it manually for accurate weather.
        </span>
        <div style={buttonRowStyle}>
          <button
            type="button"
            data-testid="location-prompt-skip"
            onClick={handleMaybeLater}
            style={secondaryButtonStyle}
          >
            Maybe later
          </button>
          <button
            type="button"
            data-testid="location-prompt-accept"
            onClick={handleSetLocation}
            style={primaryButtonStyle}
          >
            Set location
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  // Dim the slide deck behind the prompt. 60% black matches the
  // onboarding coachmark dim from plan/styling.md so the visual
  // language stays consistent with the future tutorial overlay.
  background: 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  // Above slide content (z-index 1-5) but below the auto-revealed
  // title bar so the user can still close the app via the × button
  // while the prompt is up.
  zIndex: 50,
  padding: 12,
  boxSizing: 'border-box',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '14px 14px 12px 14px',
  background: 'rgba(20, 20, 30, 0.95)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 10,
  color: 'rgba(255, 255, 255, 0.92)',
  fontFamily: 'system-ui, sans-serif',
  // Cap so the card stays readable in very wide windows without
  // stretching across the entire panel.
  maxWidth: 280,
  // Cap height to the overlay's content area so the card never
  // overflows the panel. The overlay itself uses padding: 12 +
  // box-sizing border-box, so 100% here resolves to (panel − 24 px).
  // overflowY: auto kicks in only when the card's intrinsic content
  // height exceeds that cap — fully visible content stays still, an
  // overflowing prompt becomes scrollable. Scrollbar is hidden via
  // scrollbar-width: none (same trick the Settings slide uses).
  maxHeight: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  // Shadow gives the card lift over the dimmed deck.
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 0.2,
};

const bodyStyle: CSSProperties = {
  fontSize: 11,
  lineHeight: 1.4,
  opacity: 0.85,
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  gap: 8,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  marginTop: 4,
};

const buttonBaseStyle: CSSProperties = {
  padding: '5px 11px',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  borderRadius: 5,
  cursor: 'pointer',
  letterSpacing: 0.2,
  flex: '0 1 auto',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  background: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  // Plan/styling.md sunset orange accent — primary CTA.
  background: 'rgba(255, 140, 66, 0.92)',
  color: 'rgba(15, 23, 42, 0.95)',
  border: '1px solid rgba(255, 140, 66, 0.95)',
  fontWeight: 600,
};

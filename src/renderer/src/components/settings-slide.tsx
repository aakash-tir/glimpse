import type { CSSProperties, ReactNode } from 'react';
import type {
  Settings,
  ThemeOverride,
  TimeFormat,
  Units,
} from '../../../shared/settings-store';
import { useWindowInnerWidth } from './use-window-width';

// Plan/slides.md slide 6 — Settings. Vertical scroll within the slide;
// background is theme-adaptive (handled by SlideDeck). Each control
// reads its current value from `settings` and writes back via the
// preload bridge; the resulting settings:changed broadcast updates
// every other slide that depends on it.
//
// Replay tutorial is a placeholder until M9 wires the onboarding
// restart flow — the button is rendered for layout testing but is
// inert this milestone.

// Below this width the labeled segmented controls (Units / Time
// format / Theme) crowd or wrap the row labels — collapse them to
// no-label binary switches at small widths instead. The Moon-phase
// and Track-window rows are always switches regardless of size.
//
// Threshold tuned so a default-sized window on common displays
// (1080p → 180 px, 1440p → 240 px) lands in compact mode and only
// wide windows (4 K → 360 px, or after the user manually resizes up)
// get the segmented buttons.
export const SETTINGS_COMPACT_THRESHOLD_PX = 280;

// Title metrics mirror SlideShell's TITLE_TOP_PX / TITLE_LINE_PX so
// the "Settings" title sits at exactly the same vertical position as
// every other slide's title. Settings does not use SlideShell because
// (a) the slide is theme-adaptive — the title color must follow the
// resolved palette — and (b) the body is a scroll container, which
// SlideShell's body is not.
const SETTINGS_TITLE_TOP_PX = 6;
const SETTINGS_TITLE_LINE_PX = 18;
const SETTINGS_TITLE_AREA_PX =
  SETTINGS_TITLE_TOP_PX + SETTINGS_TITLE_LINE_PX + 6;

export type SettingsSlideProps = {
  settings: Settings | null;
  /** When non-null, the row is rendered in light-mode palette. */
  luminance: 'dark' | 'light';
};

export function SettingsSlide({
  settings,
  luminance,
}: SettingsSlideProps): JSX.Element {
  const windowWidth = useWindowInnerWidth();
  const compact = windowWidth < SETTINGS_COMPACT_THRESHOLD_PX;

  if (!settings) {
    return (
      <div
        data-testid="slide-settings-shell"
        style={{ position: 'absolute', inset: 0 }}
      >
        <div
          data-testid="slide-settings-loading"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color:
              luminance === 'light'
                ? 'rgba(15, 23, 42, 0.5)'
                : 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'system-ui, sans-serif',
            fontSize: 12,
          }}
        >
          Loading settings…
        </div>
      </div>
    );
  }

  const palette = paletteFor(luminance);

  const handleSet = (patch: Partial<Settings>): void => {
    void window.glimpse?.setSettings(patch);
  };

  const handleResetIcon = (): void => {
    void window.glimpse?.resetIconPosition();
  };

  const handleManualRefresh = (): void => {
    void window.glimpse?.refreshData();
  };

  return (
    <div
      data-testid="slide-settings-shell"
      data-luminance={luminance}
      data-compact={compact ? 'on' : 'off'}
      style={{
        position: 'absolute',
        inset: 0,
        color: palette.text,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Title pinned to the top of the slide, outside the scroll
          container so it stays put while the rows scroll. Mirrors the
          SlideShell title styling but with a theme-adaptive color
          since Settings is the only theme-adaptive slide. */}
      <div
        data-testid="slide-title"
        data-slide-title="Settings"
        style={{
          position: 'absolute',
          top: SETTINGS_TITLE_TOP_PX,
          left: 0,
          right: 0,
          height: SETTINGS_TITLE_LINE_PX,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          color: palette.text,
          pointerEvents: 'none',
        }}
      >
        Settings
      </div>
      <div
        data-testid="slide-settings-scroll"
        style={{
          position: 'absolute',
          top: SETTINGS_TITLE_AREA_PX,
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          // Hide the native scrollbar — the slide's content height is
          // small enough that scrolling is rarely needed, and when it
          // is, the user can wheel/drag without a visible track. Same
          // pattern the today + 7-day slides use for their horizontal
          // scrollers.
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <div
          data-testid="slide-settings-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '4px 14px 32px 14px',
          }}
        >
          <Row label="Units" defaultHint="metric" palette={palette}>
            {compact ? (
              <Switch
                testId="settings-units"
                checked={settings.units === 'imperial'}
                onChange={(v) =>
                  handleSet({ units: v ? 'imperial' : 'metric' })
                }
                palette={palette}
                ariaLabel="Units (off: metric, on: imperial)"
              />
            ) : (
              <Segmented
                testId="settings-units"
                value={settings.units}
                options={[
                  { value: 'metric', label: 'Metric' },
                  { value: 'imperial', label: 'Imperial' },
                ]}
                onChange={(v: Units) => handleSet({ units: v })}
                palette={palette}
              />
            )}
          </Row>

          <Row label="Time format" defaultHint="12 h" palette={palette}>
            {compact ? (
              <Switch
                testId="settings-time-format"
                checked={settings.timeFormat === '24h'}
                onChange={(v) => handleSet({ timeFormat: v ? '24h' : '12h' })}
                palette={palette}
                ariaLabel="Time format (off: 12h, on: 24h)"
              />
            ) : (
              <Segmented
                testId="settings-time-format"
                value={settings.timeFormat}
                options={[
                  { value: '24h', label: '24 h' },
                  { value: '12h', label: '12 h' },
                ]}
                onChange={(v: TimeFormat) => handleSet({ timeFormat: v })}
                palette={palette}
              />
            )}
          </Row>

          <Row label="Moon-phase slide" defaultHint="off" palette={palette}>
            <Switch
              testId="settings-moon-toggle"
              checked={settings.moonPhaseSlideEnabled}
              onChange={(v) => handleSet({ moonPhaseSlideEnabled: v })}
              palette={palette}
              ariaLabel="Moon-phase slide"
            />
          </Row>

          <Row label="Theme" defaultHint="light" palette={palette}>
            {compact ? (
              <Switch
                testId="settings-theme"
                // At compact size the switch only exposes the binary
                // light/dark choice. If the user previously selected
                // 'auto', reflect the currently-resolved theme so the
                // switch position matches what they see; clicking
                // explicitly sets light or dark, replacing 'auto'.
                checked={
                  settings.themeOverride === 'dark' ||
                  (settings.themeOverride === 'auto' && luminance === 'dark')
                }
                onChange={(v) =>
                  handleSet({ themeOverride: v ? 'dark' : 'light' })
                }
                palette={palette}
                ariaLabel="Theme (off: light, on: dark)"
              />
            ) : (
              <Segmented
                testId="settings-theme"
                value={settings.themeOverride}
                options={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                onChange={(v: ThemeOverride) => handleSet({ themeOverride: v })}
                palette={palette}
              />
            )}
          </Row>

          <Row
            label="Track window position"
            defaultHint="off"
            palette={palette}
          >
            <Switch
              testId="settings-track-window"
              checked={settings.trackWindowPosition}
              onChange={(v) => handleSet({ trackWindowPosition: v })}
              palette={palette}
              ariaLabel="Track window position"
            />
          </Row>

          <Row label="Reset icon position" palette={palette}>
            <ActionButton
              testId="settings-reset-icon"
              onClick={handleResetIcon}
              palette={palette}
            >
              Reset
            </ActionButton>
          </Row>

          <Row label="Manual refresh" palette={palette}>
            <ActionButton
              testId="settings-manual-refresh"
              onClick={handleManualRefresh}
              palette={palette}
            >
              Refresh
            </ActionButton>
          </Row>

          <Row label="Replay tutorial" palette={palette}>
            {/* M9 wires the actual replay flow. Rendering the row + a
              disabled button now keeps the layout stable through the
              milestone gap. */}
            <ActionButton
              testId="settings-replay-tutorial"
              onClick={() => {
                /* M9 */
              }}
              palette={palette}
              disabled
            >
              Replay
            </ActionButton>
          </Row>

          <div
            data-testid="settings-about"
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: `1px solid ${palette.divider}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Glimpse</span>
            <span style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.4 }}>
              Weather data: Open-Meteo · Aurora data: NOAA SWPC · Astronomy:
              SunCalc
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

type Palette = {
  text: string;
  textMuted: string;
  rowBg: string;
  segActiveBg: string;
  segInactiveBg: string;
  segBorder: string;
  segActiveText: string;
  segInactiveText: string;
  buttonBg: string;
  buttonText: string;
  buttonBorder: string;
  divider: string;
  switchOnTrack: string;
  switchOffTrack: string;
  switchThumb: string;
};

// Blue used for the on-state of binary switches. Distinct from the
// warm-orange accent so the switch reads as a system control rather
// than a "celebration" accent.
const SWITCH_BLUE = '#3b82f6';

function paletteFor(luminance: 'dark' | 'light'): Palette {
  if (luminance === 'light') {
    return {
      text: 'rgba(15, 23, 42, 0.95)',
      textMuted: 'rgba(15, 23, 42, 0.65)',
      rowBg: 'rgba(15, 23, 42, 0.04)',
      segActiveBg: 'rgba(255, 140, 66, 0.85)',
      segInactiveBg: 'rgba(15, 23, 42, 0.05)',
      segBorder: 'rgba(15, 23, 42, 0.12)',
      segActiveText: 'rgba(255, 255, 255, 0.95)',
      segInactiveText: 'rgba(15, 23, 42, 0.7)',
      buttonBg: 'rgba(15, 23, 42, 0.05)',
      buttonText: 'rgba(15, 23, 42, 0.85)',
      buttonBorder: 'rgba(15, 23, 42, 0.12)',
      divider: 'rgba(15, 23, 42, 0.12)',
      switchOnTrack: SWITCH_BLUE,
      switchOffTrack: 'rgba(15, 23, 42, 0.18)',
      switchThumb: 'rgba(255, 255, 255, 1)',
    };
  }
  return {
    text: 'rgba(255, 255, 255, 0.92)',
    textMuted: 'rgba(255, 255, 255, 0.65)',
    rowBg: 'rgba(255, 255, 255, 0.04)',
    segActiveBg: 'rgba(255, 140, 66, 0.85)',
    segInactiveBg: 'rgba(255, 255, 255, 0.06)',
    segBorder: 'rgba(255, 255, 255, 0.12)',
    segActiveText: 'rgba(15, 23, 42, 0.95)',
    segInactiveText: 'rgba(255, 255, 255, 0.75)',
    buttonBg: 'rgba(255, 255, 255, 0.06)',
    buttonText: 'rgba(255, 255, 255, 0.92)',
    buttonBorder: 'rgba(255, 255, 255, 0.12)',
    divider: 'rgba(255, 255, 255, 0.12)',
    switchOnTrack: SWITCH_BLUE,
    switchOffTrack: 'rgba(255, 255, 255, 0.22)',
    switchThumb: 'rgba(255, 255, 255, 1)',
  };
}

function Row({
  label,
  defaultHint,
  palette,
  children,
}: {
  label: string;
  /**
   * Optional hint shown in brackets after the label, indicating the
   * value the off-position represents (e.g. "metric" for the Units
   * switch). Lets the user read what each switch's default state
   * means without labeled segments.
   */
  defaultHint?: string;
  palette: Palette;
  children: ReactNode;
}): JSX.Element {
  return (
    <div
      data-testid="settings-row"
      data-row-label={label}
      data-row-default-hint={defaultHint ?? ''}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '6px 8px',
        background: palette.rowBg,
        borderRadius: 6,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: palette.textMuted,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        {label}
        {defaultHint ? (
          <span
            data-testid="settings-row-default-hint"
            style={{ marginLeft: 4, opacity: 0.55, fontSize: 10 }}
          >
            ({defaultHint})
          </span>
        ) : null}
      </span>
      <span style={{ flex: '0 0 auto', display: 'inline-flex' }}>
        {children}
      </span>
    </div>
  );
}

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

function Segmented<T extends string>({
  testId,
  value,
  options,
  onChange,
  palette,
}: {
  testId: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  palette: Palette;
}): JSX.Element {
  return (
    <span
      data-testid={testId}
      data-current-value={value}
      style={{
        display: 'inline-flex',
        border: `1px solid ${palette.segBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            data-testid={`${testId}-${opt.value}`}
            data-active={active ? 'on' : 'off'}
            onClick={(e) => {
              // Prevent a panel-level double-click from absorbing the
              // setting toggle (the click classifier in window-view
              // would otherwise queue this as part of a double-click).
              e.stopPropagation();
              if (!active) onChange(opt.value);
            }}
            style={{
              ...segmentBaseStyle,
              background: active ? palette.segActiveBg : palette.segInactiveBg,
              color: active ? palette.segActiveText : palette.segInactiveText,
              fontWeight: active ? 600 : 500,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </span>
  );
}

function ActionButton({
  testId,
  onClick,
  palette,
  disabled,
  children,
}: {
  testId: string;
  onClick: () => void;
  palette: Palette;
  disabled?: boolean;
  children: ReactNode;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      data-disabled={disabled ? 'on' : 'off'}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick();
      }}
      style={{
        ...segmentBaseStyle,
        background: palette.buttonBg,
        color: palette.buttonText,
        border: `1px solid ${palette.buttonBorder}`,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const segmentBaseStyle: CSSProperties = {
  border: 'none',
  padding: '4px 10px',
  fontSize: 11,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
  letterSpacing: 0.2,
};

// Compact iOS-style switch for binary on/off toggles. The track is
// blue (#3b82f6) when on and a translucent neutral when off; the
// thumb is a white circle that slides between left/right ends with a
// 150 ms ease. No labels — position alone signals state, which is
// what the user feedback asked for after the labeled "On / Off"
// segmented control crowded narrow row labels.
const SWITCH_WIDTH = 32;
const SWITCH_HEIGHT = 18;
const SWITCH_PADDING = 2;
const SWITCH_THUMB = SWITCH_HEIGHT - SWITCH_PADDING * 2;

function Switch({
  testId,
  checked,
  onChange,
  palette,
  ariaLabel,
}: {
  testId: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  palette: Palette;
  ariaLabel: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      data-checked={checked ? 'on' : 'off'}
      data-current-value={checked ? 'on' : 'off'}
      onClick={(e) => {
        // Same defensive stopPropagation as the segmented buttons —
        // the panel-level double-click classifier mustn't absorb the
        // toggle into a window-drag gesture.
        e.stopPropagation();
        onChange(!checked);
      }}
      style={{
        position: 'relative',
        width: SWITCH_WIDTH,
        height: SWITCH_HEIGHT,
        padding: 0,
        border: 'none',
        borderRadius: SWITCH_HEIGHT / 2,
        backgroundColor: checked
          ? palette.switchOnTrack
          : palette.switchOffTrack,
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
        flex: '0 0 auto',
      }}
    >
      <span
        data-testid={`${testId}-thumb`}
        style={{
          position: 'absolute',
          top: SWITCH_PADDING,
          left: checked
            ? SWITCH_WIDTH - SWITCH_PADDING - SWITCH_THUMB
            : SWITCH_PADDING,
          width: SWITCH_THUMB,
          height: SWITCH_THUMB,
          borderRadius: '50%',
          backgroundColor: palette.switchThumb,
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
          transition: 'left 150ms ease',
        }}
      />
    </button>
  );
}

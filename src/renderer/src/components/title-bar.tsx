import { useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { CornerUpRight, X } from 'lucide-react';
import type { Condition } from '../../../shared/condition';
import { conditionToGlyph } from '../../../shared/condition';
import { IconGlyph } from './icon-glyph';

// Plan/window.md: "Auto-hides in window mode. Trigger: hovering the top
// edge (top ~24 px) reveals it. 150 ms fade-in, 300 ms fade-out."
export const TITLE_BAR_HEIGHT_PX = 32;
export const TITLE_BAR_TRIGGER_HEIGHT_PX = 24;
export const TITLE_BAR_FADE_IN_MS = 150;
export const TITLE_BAR_FADE_OUT_MS = 300;

// Plan/styling.md: "'Glimpse' wordmark in the title bar: white-70 % on
// dark slide backgrounds, slate-70 % on the (light-mode) Settings slide."
const WORDMARK_COLOR_DARK_BG = 'rgba(255, 255, 255, 0.7)';
const WORDMARK_COLOR_LIGHT_BG = 'rgba(15, 23, 42, 0.7)'; // slate-900-70%
// Same adaptive treatment is used for the close button glyph and the
// other right-side icon strokes so they remain legible against either
// title-bar-tinted background.

const TITLE_BAR_BG_DARK = 'rgba(20, 20, 30, 0.85)';
const TITLE_BAR_BG_LIGHT = 'rgba(248, 250, 252, 0.85)'; // slate-50-85%

export type TitleBarBackground = 'dark' | 'light';

export type TitleBarProps = {
  // Current condition + day/night, used for the weather glyph in the
  // title bar's left slot. Defaults to clear-day (the same placeholder
  // IconView uses) until real weather data lands in M5.
  condition?: Condition;
  isDay?: boolean;
  // Resolved background color of the slide currently behind the title
  // bar, so the wordmark + button colors can adapt for legibility.
  // Defaults to 'dark' since every slide except the (light-mode)
  // Settings slide uses a dark background.
  background?: TitleBarBackground;
  // When true, the trigger container becomes hover-inert and the bar
  // stays hidden. Used while window-drag mode is active per
  // plan/window.md ("Title bar is not accessible while in drag mode
  // (must exit drag first).").
  disabled?: boolean;
  // Click handlers — wired in a follow-up commit. Stubs for now keep
  // the test surface stable.
  onWeatherIconClick?: () => void;
  onMinimize?: () => void;
  onRelocate?: () => void;
  onClose?: () => void;
};

export function TitleBar({
  condition = 'clear',
  isDay = true,
  background = 'dark',
  disabled = false,
  onWeatherIconClick,
  onMinimize,
  onRelocate,
  onClose,
}: TitleBarProps): JSX.Element {
  const [visible, setVisible] = useState(false);

  const effectiveVisible = disabled ? false : visible;

  const wordmarkColor =
    background === 'dark' ? WORDMARK_COLOR_DARK_BG : WORDMARK_COLOR_LIGHT_BG;
  const titleBarBg =
    background === 'dark' ? TITLE_BAR_BG_DARK : TITLE_BAR_BG_LIGHT;

  // The hover container's height collapses to the trigger zone when
  // invisible (so only the top 24 px reveals) and grows to the full
  // title bar height when visible (so the user can move into the bar
  // without losing hover).
  const containerHeight = effectiveVisible
    ? TITLE_BAR_HEIGHT_PX
    : TITLE_BAR_TRIGGER_HEIGHT_PX;

  return (
    <div
      data-testid="title-bar-container"
      data-visible={effectiveVisible ? 'on' : 'off'}
      data-disabled={disabled ? 'on' : 'off'}
      data-trigger-height-px={TITLE_BAR_TRIGGER_HEIGHT_PX}
      data-bar-height-px={TITLE_BAR_HEIGHT_PX}
      data-fade-in-ms={TITLE_BAR_FADE_IN_MS}
      data-fade-out-ms={TITLE_BAR_FADE_OUT_MS}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: containerHeight,
        zIndex: 10,
        // While disabled, the trigger swallows neither hover nor clicks
        // so the panel beneath (and its drag-mode gestures) gets them.
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <motion.div
        data-testid="title-bar"
        data-background={background}
        initial={{ opacity: 0 }}
        animate={{ opacity: effectiveVisible ? 1 : 0 }}
        transition={{
          duration:
            (effectiveVisible ? TITLE_BAR_FADE_IN_MS : TITLE_BAR_FADE_OUT_MS) /
            1000,
          ease: 'easeOut',
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: TITLE_BAR_HEIGHT_PX,
          background: titleBarBg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          padding: '0 6px',
          // When invisible, swallow no clicks so anything below in the
          // panel can be interacted with.
          pointerEvents: effectiveVisible ? 'auto' : 'none',
        }}
      >
        <div style={leftCellStyle}>
          <button
            data-testid="title-bar-weather-icon"
            type="button"
            aria-label="Collapse to icon"
            onClick={onWeatherIconClick}
            style={iconButtonStyle}
          >
            <IconGlyph name={conditionToGlyph(condition, isDay)} size={18} />
          </button>
        </div>

        <div
          data-testid="title-bar-wordmark"
          style={{
            color: wordmarkColor,
            fontSize: 14,
            fontWeight: 400,
            fontFamily: 'system-ui, sans-serif',
            letterSpacing: 0.2,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          Glimpse
        </div>

        <div style={rightCellStyle}>
          <button
            data-testid="title-bar-minimize"
            type="button"
            aria-label="Minimize to icon"
            onClick={onMinimize}
            style={iconButtonStyle}
          >
            <MinimizeToIconGlyph color={wordmarkColor} />
          </button>
          <button
            data-testid="title-bar-relocate"
            type="button"
            aria-label="Reset icon position"
            onClick={onRelocate}
            style={iconButtonStyle}
          >
            <CornerUpRight size={16} color={wordmarkColor} />
          </button>
          <button
            data-testid="title-bar-close"
            type="button"
            aria-label="Quit Glimpse"
            onClick={onClose}
            style={iconButtonStyle}
          >
            <X size={16} color={wordmarkColor} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const leftCellStyle: CSSProperties = {
  justifySelf: 'start',
  display: 'flex',
  alignItems: 'center',
};

const rightCellStyle: CSSProperties = {
  justifySelf: 'end',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
};

const iconButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  padding: 4,
  margin: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'inherit',
  borderRadius: 4,
};

// Custom minimize-to-icon glyph: a square with a smaller square in the
// top-right (per plan/window.md). Stroked with the same adaptive color
// as the wordmark for visual consistency.
function MinimizeToIconGlyph({ color }: { color: string }): JSX.Element {
  return (
    <svg
      data-testid="title-bar-minimize-glyph"
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Outer square */}
      <rect x={2.5} y={4.5} width={9} height={9} rx={1} />
      {/* Smaller square in the top-right */}
      <rect x={9} y={2} width={5} height={5} rx={0.8} fill={color} />
    </svg>
  );
}

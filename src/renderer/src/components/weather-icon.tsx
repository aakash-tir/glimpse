import { AnimatePresence, motion } from 'framer-motion';
import type { Condition, IconGlyphName } from '../../../shared/condition';
import { conditionToGlyph } from '../../../shared/condition';
import { DragModeGlow } from './drag-mode-glow';
import { IconGlyph } from './icon-glyph';
import { LoadingCloud } from './loading-cloud';
import { SadCloud } from './sad-cloud';
import { Tooltip } from './tooltip';

export const ERROR_TOOLTIP_TEXT = 'weather could not be determined';
export const HOVER_SCALE = 1.15;
export const HOVER_DURATION_S = 0.15;
export const CROSSFADE_DURATION_S = 0.2;

export type IconState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; condition: Condition; isDay: boolean };

function ReadyContents({ glyph }: { glyph: IconGlyphName }): JSX.Element {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={glyph}
        data-testid="icon-ready"
        data-glyph={glyph}
        data-crossfade-duration-s={CROSSFADE_DURATION_S}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: CROSSFADE_DURATION_S, ease: 'linear' }}
        style={{ width: 64, height: 64 }}
      >
        <IconGlyph name={glyph} size={64} />
      </motion.div>
    </AnimatePresence>
  );
}

export type WeatherIconProps = {
  state: IconState;
  dragMode?: boolean;
  onClick?: () => void;
};

export function WeatherIcon({
  state,
  dragMode = false,
  onClick,
}: WeatherIconProps): JSX.Element {
  const inner =
    state.kind === 'loading' ? (
      <LoadingCloud size={64} />
    ) : state.kind === 'error' ? (
      <SadCloud size={64} />
    ) : (
      <ReadyContents glyph={conditionToGlyph(state.condition, state.isDay)} />
    );

  const wrapped = (
    <motion.div
      data-testid="icon-root"
      data-icon-state={state.kind}
      data-drag-mode={dragMode ? 'on' : 'off'}
      data-hover-scale={HOVER_SCALE}
      data-hover-duration-s={HOVER_DURATION_S}
      whileHover={dragMode ? undefined : { scale: HOVER_SCALE }}
      transition={{ duration: HOVER_DURATION_S, ease: 'easeOut' }}
      onClick={onClick}
      style={{
        width: 64,
        height: 64,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      {dragMode && <DragModeGlow />}
      {inner}
    </motion.div>
  );

  // Tooltip wraps only the error state per plan/icon.md.
  if (state.kind === 'error') {
    return <Tooltip text={ERROR_TOOLTIP_TEXT}>{wrapped}</Tooltip>;
  }
  return wrapped;
}

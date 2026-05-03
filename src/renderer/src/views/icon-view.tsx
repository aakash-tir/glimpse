import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { WeatherIcon } from '../components/weather-icon';
import { useClickClassifier } from '../components/use-click-classifier';

// Mirror of WindowView's WINDOW_SCALE_DURATION_S. The IconView
// opacity-fade-out timing matches WindowView's collapse fade so the two
// directions feel symmetric.
const ICON_FADE_DURATION_S = 0.2;

// IconView — the collapsed, icon-mode renderer. Owns its own drag-mode
// state and the icon's click handlers. Single-click asks main to
// expand to window mode; double-click toggles drag mode.
export function IconView(): JSX.Element {
  const [dragMode, setDragMode] = useState(false);
  // Latched when the click classifier commits a single-click that
  // triggers expand. Drives an opacity fade-out on the IconView root —
  // mirror of the M3 polish (commit 92396c3) that opacity-fades
  // WindowView during collapse to mask the 1–2 frame paint race
  // between mode:changed and the OS resizing the BrowserWindow. The
  // expand direction has the same race (renderer's last paint of
  // IconView, with the glyph at icon-mode local (16, 16), gets
  // stretched into the freshly-resized window — visible as the glyph
  // flashing at the new window's top-left), and the fix is the
  // same: fade the source view to opacity 0 over ~200 ms so even if
  // the OS uses a stale framebuffer mid-fade, what it stretches is
  // already partially transparent and dissolves into the wallpaper
  // rather than reading as a sharp glyph at top-left.
  const [expanding, setExpanding] = useState(false);
  // Set true after the fade-out animation completes. Adds a hard
  // visibility:hidden on top of opacity:0 so a stale paint after the
  // animation finishes can't reintroduce the glyph.
  const [hidden, setHidden] = useState(false);
  const isDraggingRef = useRef(false);

  const handleSingleClick = useCallback(() => {
    // Single-click only expands when not in drag mode (drag mode swallows
    // single clicks per plan/icon.md). Also gated on `expanding` so a
    // stray click during the fade-out doesn't fire a second expand IPC.
    if (dragMode || expanding) return;
    setExpanding(true);
    void window.glimpse?.expand();
  }, [dragMode, expanding]);

  const handleFadeAnimationComplete = useCallback(() => {
    if (expanding) setHidden(true);
  }, [expanding]);

  const handleDoubleClick = useCallback(() => {
    setDragMode((on) => !on);
  }, []);

  const { click: handleIconClick, cancelPending: cancelPendingClick } =
    useClickClassifier({
      onSingleClick: handleSingleClick,
      onDoubleClick: handleDoubleClick,
    });

  // Window blur (focus moved to another app or the desktop) exits drag
  // mode — the user has effectively "clicked outside" the icon. Same
  // pending-click cancellation as handleOutsideClick: a queued click
  // recorded while in drag mode shouldn't fire onSingleClick after the
  // blur flips dragMode to false.
  useEffect(() => {
    if (!dragMode) return;
    const onBlur = (): void => {
      setDragMode(false);
      cancelPendingClick();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [dragMode, cancelPendingClick]);

  // Mousemove + mouseup are bound at the window level so a fast cursor
  // that briefly outpaces the moving icon window doesn't drop the drag
  // mid-gesture.
  useEffect(() => {
    if (!dragMode) return;
    const onMouseMove = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      window.glimpse?.dragMove({ x: e.screenX, y: e.screenY });
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      window.glimpse?.dragEnd({ x: e.screenX, y: e.screenY });
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragMode]);

  // Click on the transparent area of the icon window (anywhere outside the
  // 64x64 glyph) also exits drag mode. The icon's own click handler stops
  // propagation, so this listener only fires for off-icon clicks.
  //
  // Also cancels any pending click queued in the click classifier — see
  // the bug where clicking on the icon while in drag mode (which queues
  // a 250 ms single-click timer) and then clicking off-icon (which exits
  // drag mode) would let the queued timer fire after dragMode flipped to
  // false, mistakenly triggering expand(). The cancel ensures the queued
  // click is discarded along with the drag-mode exit.
  const handleOutsideClick = useCallback(() => {
    if (!dragMode) return;
    setDragMode(false);
    cancelPendingClick();
  }, [dragMode, cancelPendingClick]);

  const handleIconClickWithStop = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      handleIconClick();
    },
    [handleIconClick],
  );

  const handleIconMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!dragMode) return;
      e.preventDefault();
      isDraggingRef.current = true;
      window.glimpse?.dragStart({ x: e.screenX, y: e.screenY });
    },
    [dragMode],
  );

  return (
    <motion.div
      data-testid="icon-view"
      data-drag-mode={dragMode ? 'on' : 'off'}
      data-expanding={expanding ? 'on' : 'off'}
      data-hidden={hidden ? 'on' : 'off'}
      data-icon-fade-duration-s={ICON_FADE_DURATION_S}
      animate={{ opacity: expanding ? 0 : 1 }}
      transition={{ duration: ICON_FADE_DURATION_S, ease: 'easeOut' }}
      onAnimationComplete={handleFadeAnimationComplete}
      onClick={handleOutsideClick}
      style={
        {
          width: '100vw',
          height: '100vh',
          background: 'transparent',
          position: 'relative',
          WebkitAppRegion: 'no-drag',
          // visibility (not display:none) so the still-running fade
          // animation doesn't get yanked mid-frame. Only kicks in after
          // the fade completes; until then the opacity animation does
          // the work.
          visibility: hidden ? 'hidden' : 'visible',
        } as React.CSSProperties
      }
    >
      <div
        style={{
          position: 'absolute',
          // Anchor the glyph to the WINDOW CENTER rather than to the
          // icon-mode top-left offset. In icon mode (96 × 96) the
          // window center is (48, 48) which equals ICON_PADDING +
          // ICON_SIZE / 2 — so the visual position is identical to
          // the previous (16, 16) top-left + 64×64 glyph anchoring.
          //
          // The reason this matters: when main calls setBounds() to
          // expand, the BrowserWindow both *resizes* and *moves* to
          // new screen bounds. The OS reuses the renderer's stale
          // framebuffer to fill the new window with content anchored
          // to the new top-left. Local (16, 16) of a 200×200 window
          // is at a completely different screen position than local
          // (16, 16) of the 96×96 window — visible as the glyph
          // "moving to top-left" of the new window.
          //
          // expandFromIcon() (in shared/window-position.ts) centers
          // the new window on the icon's pre-expand center, so the
          // window CENTER stays at the same screen position before
          // and after the resize. Center-anchoring the glyph means
          // it stays at the same screen position too, regardless of
          // the window resize. The glyph just sits there until
          // WindowView mounts and covers it.
          //
          // Edge case: when the icon is at the canonical default
          // top-right position, expandFromIcon returns the default
          // window bounds (a fixed screen location, not centered on
          // the icon). The glyph would jump to the new window's
          // center in that case — the opacity-fade animation on the
          // IconView root masks that.
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        onClick={handleIconClickWithStop}
        onMouseDown={handleIconMouseDown}
      >
        <WeatherIcon
          state={{ kind: 'ready', condition: 'clear', isDay: true }}
          dragMode={dragMode}
        />
      </div>
    </motion.div>
  );
}

// Pure drag-translation arithmetic. Given the cursor and icon positions
// captured at the start of a drag, plus the current cursor screen
// coordinates, returns the icon's new top-left position. The cursor's
// offset within the icon is preserved across the drag, so the icon
// "follows" the cursor without snapping its top-left to the cursor.

import type { IconPosition } from './settings-store';

export type ScreenPoint = { x: number; y: number };

export function computeIconPosFromCursor(
  startCursor: ScreenPoint,
  startIcon: IconPosition,
  currentCursor: ScreenPoint,
): IconPosition {
  return {
    x: startIcon.x + (currentCursor.x - startCursor.x),
    y: startIcon.y + (currentCursor.y - startCursor.y),
  };
}

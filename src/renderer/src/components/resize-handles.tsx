import { useCallback, useEffect, useRef, type CSSProperties } from 'react';
import type { ResizeCorner } from '../../../shared/window-position';

// Plan/window.md: "Resizable via the four corner handles only (no edge
// handles). Width and height are kept equal during resize."
//
// Each corner is a small invisible region (16 x 16) at z-index above
// the title bar so resizing remains accessible even when the title
// bar covers the top corners. The square-lock + min/max enforcement
// happens in main via the squareResize helper.

export const RESIZE_HANDLE_SIZE_PX = 16;
// Above the title bar (z-index 10) so the corners stay reachable when
// the title bar is visible.
const RESIZE_HANDLE_Z_INDEX = 20;

type CornerStyle = { style: CSSProperties; cursor: string };

const corners: Record<ResizeCorner, CornerStyle> = {
  'top-left': {
    style: { top: 0, left: 0 },
    cursor: 'nwse-resize',
  },
  'top-right': {
    style: { top: 0, right: 0 },
    cursor: 'nesw-resize',
  },
  'bottom-left': {
    style: { bottom: 0, left: 0 },
    cursor: 'nesw-resize',
  },
  'bottom-right': {
    style: { bottom: 0, right: 0 },
    cursor: 'nwse-resize',
  },
};

const testIdByCorner: Record<ResizeCorner, string> = {
  'top-left': 'resize-handle-top-left',
  'top-right': 'resize-handle-top-right',
  'bottom-left': 'resize-handle-bottom-left',
  'bottom-right': 'resize-handle-bottom-right',
};

export function ResizeHandles(): JSX.Element {
  const isResizingRef = useRef(false);

  const handleMouseDown = useCallback(
    (corner: ResizeCorner) =>
      (e: React.MouseEvent<HTMLDivElement>): void => {
        const api = window.glimpse;
        if (!api) return;
        e.preventDefault();
        e.stopPropagation();
        isResizingRef.current = true;
        api.resizeStart(corner, { x: e.screenX, y: e.screenY });
      },
    [],
  );

  // Window-level mousemove + mouseup so a fast cursor that briefly
  // outpaces the resizing window doesn't drop the gesture.
  useEffect(() => {
    const onMouseMove = (e: MouseEvent): void => {
      if (!isResizingRef.current) return;
      window.glimpse?.resizeMove({ x: e.screenX, y: e.screenY });
    };
    const onMouseUp = (e: MouseEvent): void => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      window.glimpse?.resizeEnd({ x: e.screenX, y: e.screenY });
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <>
      {(Object.keys(corners) as ResizeCorner[]).map((corner) => (
        <div
          key={corner}
          data-testid={testIdByCorner[corner]}
          data-resize-corner={corner}
          onMouseDown={handleMouseDown(corner)}
          style={{
            position: 'absolute',
            width: RESIZE_HANDLE_SIZE_PX,
            height: RESIZE_HANDLE_SIZE_PX,
            zIndex: RESIZE_HANDLE_Z_INDEX,
            cursor: corners[corner].cursor,
            ...corners[corner].style,
          }}
        />
      ))}
    </>
  );
}

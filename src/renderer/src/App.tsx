import { useEffect, useState } from 'react';
import type { Mode, ModeChange } from '../../shared/mode';
import { IconView } from './views/icon-view';
import { WindowView } from './views/window-view';

// Top-level mode router. Mode is owned by main; the renderer just
// listens for transitions and swaps between views. The initial mode is
// fetched once at mount so the renderer doesn't briefly show the wrong
// view if main is in a non-default state. The ModeChange payload from
// transitions carries the entry-animation anchor for the new view.
export function App(): JSX.Element {
  const [mode, setMode] = useState<Mode>('icon');
  const [enterAnchor, setEnterAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [enterBounds, setEnterBounds] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = window.glimpse;
    if (!api) return;
    void api.getMode().then((current) => {
      if (!cancelled) setMode(current);
    });
    const off = api.onModeChanged((change: ModeChange) => {
      setMode(change.mode);
      setEnterAnchor(change.anchor);
      setEnterBounds(change.bounds);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  if (mode === 'window') {
    return <WindowView enterAnchor={enterAnchor} enterBounds={enterBounds} />;
  }
  return <IconView />;
}

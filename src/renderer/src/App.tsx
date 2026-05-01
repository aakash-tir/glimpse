import { useEffect, useState } from 'react';
import type { Mode } from '../../shared/mode';
import { IconView } from './views/icon-view';
import { WindowView } from './views/window-view';

// Top-level mode router. Mode is owned by main; the renderer just
// listens for transitions and swaps between views. The initial value
// is fetched once at mount so the renderer doesn't briefly render the
// wrong view if main is in a non-default state.
export function App(): JSX.Element {
  const [mode, setMode] = useState<Mode>('icon');

  useEffect(() => {
    let cancelled = false;
    const api = window.glimpse;
    if (!api) return;
    void api.getMode().then((current) => {
      if (!cancelled) setMode(current);
    });
    const off = api.onModeChanged(setMode);
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return mode === 'window' ? <WindowView /> : <IconView />;
}

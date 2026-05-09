import { useEffect, useState } from 'react';
import type { ResolvedTheme } from '../../../shared/theme';

// Subscribes the calling component to the resolved-theme stream from
// main: pulls once on mount, then listens for theme:changed pushes.
//
// Main resolves the value (themeOverride + nativeTheme.shouldUseDarkColors)
// so the renderer never has to know about the OS preference.
//
// Returns 'dark' synchronously while the initial getTheme() promise is
// in flight so the very first render doesn't briefly show the wrong
// palette — most slides are dark-by-default and Settings is dark unless
// the user has flipped it.
export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>('dark');

  useEffect(() => {
    let cancelled = false;
    const api = window.glimpse;
    if (!api) return;
    void api.getTheme().then((t) => {
      if (!cancelled) setTheme(t);
    });
    const off = api.onThemeChanged((t) => {
      setTheme(t);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return theme;
}

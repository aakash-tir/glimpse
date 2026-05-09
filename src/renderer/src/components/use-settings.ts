import { useEffect, useState } from 'react';
import type { Settings } from '../../../shared/settings-store';

// Subscribes the calling component to the persisted settings: pulls
// once on mount, then listens for `settings:changed` broadcasts. Every
// successful settings:set in main triggers a push here, so the renderer
// stays in sync without each consumer needing its own re-fetch path.
//
// Returns null until the initial getSettings() promise resolves —
// consumers treat null as "still loading".
export function useSettings(): Settings | null {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = window.glimpse;
    if (!api) return;
    void api.getSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    const off = api.onSettingsChanged((s) => {
      setSettings(s);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return settings;
}

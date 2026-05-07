import { useEffect, useState } from 'react';
import type { DataSnapshot } from '../../../shared/data-snapshot';

// Subscribes the calling component to the main-process data store via
// the preload bridge: pulls the current snapshot once on mount, then
// listens for `data:changed` pushes for the lifetime of the component.
//
// Returns `null` until the initial getData() promise resolves — this
// is the brief gap between renderer mount and the IPC round-trip.
// Consumers treat null the same as the loading state.
export function useDataSnapshot(): DataSnapshot | null {
  const [snapshot, setSnapshot] = useState<DataSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    const api = window.glimpse;
    if (!api) return;
    void api.getData().then((snap) => {
      if (!cancelled) setSnapshot(snap);
    });
    const off = api.onDataChanged((snap) => {
      setSnapshot(snap);
    });
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return snapshot;
}

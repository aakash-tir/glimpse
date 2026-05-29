import { useEffect, useState } from 'react';
import type { Mode, ModeChange } from '../../shared/mode';
import { IconView } from './views/icon-view';
import { WindowView } from './views/window-view';
import { OnboardingController } from './components/onboarding-controller';

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
  // Read synchronously at first paint so the icon view never flashes
  // inside the larger onboarding panel.
  const [onboarding, setOnboarding] = useState<boolean>(
    () => window.glimpse?.isOnboardingActive() ?? false,
  );
  // True once the tutorial finished via "Done" (not skip), so the
  // window opens on the Settings slide with the completion toast.
  const [completedOnboarding, setCompletedOnboarding] = useState(false);

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

  // Replay from Settings: main re-enters the onboarding panel and pushes
  // this event so the controller re-mounts at step 1.
  useEffect(() => {
    const api = window.glimpse;
    if (!api?.onOnboardingReplay) return;
    return api.onOnboardingReplay(() => {
      setCompletedOnboarding(false);
      setOnboarding(true);
    });
  }, []);

  if (onboarding) {
    return (
      <OnboardingController
        onFinish={(reason) => {
          setOnboarding(false);
          if (reason === 'complete') setCompletedOnboarding(true);
        }}
      />
    );
  }
  if (mode === 'window') {
    return (
      <WindowView
        enterAnchor={enterAnchor}
        enterBounds={enterBounds}
        justCompletedOnboarding={completedOnboarding}
      />
    );
  }
  return <IconView />;
}

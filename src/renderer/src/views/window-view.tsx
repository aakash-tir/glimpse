import { useCallback } from 'react';

// WindowView — the expanded panel placeholder. Real slide content lands
// in M4 (slide framework). For now this is a dark-glass square that
// fills the window; clicking anywhere on it asks main to collapse so
// the round-trip is exercisable end-to-end before the title bar (and
// its proper collapse buttons) arrives in a follow-up commit.
export function WindowView(): JSX.Element {
  const handleCollapse = useCallback(() => {
    void window.glimpse?.collapse();
  }, []);

  return (
    <div
      data-testid="window-view"
      onClick={handleCollapse}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.92)',
        color: 'rgba(255, 255, 255, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      Glimpse
    </div>
  );
}

# Icon-expand glyph flash (Windows DWM swap-chain race)

**Status:** Mitigated with a temporary workaround in `src/renderer/src/views/icon-view.tsx`. Not a true fix — the underlying race still exists; we just give it enough time to lose.

**First seen:** M3 manual testing (icon → window expand).

## Symptom

On single-click of the icon, occasionally — more often on busy / hardware-accelerated machines — the 64 × 64 weather glyph briefly appears anchored at the **top-left of the newly expanded window** for one frame before the window finishes its scale animation. Looks like a flash / flicker. Reproducibility is timing-dependent; some sessions never show it, others show it on most expansions.

## Cause

It's a Windows DWM / DXGI swap-chain timing race, not an Electron or React bug.

The expand sequence is:

1. Renderer: `setExpanding(true)` → React commit → glyph element flips to `visibility: hidden` → repaint.
2. Renderer → main IPC: `window.glimpse.expand()`.
3. Main: `iconWindow.setBounds(<window-mode bounds>)` synchronously.
4. DWM composites the resized window for the next vsync.

The renderer pipeline has more legs than just "paint":

```
React commit → paint (renderer)
            → composite (GPU process)
            → swap-chain present (OS / DXGI)
            → DWM displays at next vsync
```

`setBounds` runs on the main process and reaches DWM almost immediately. DWM uses **whatever surface the swap chain currently holds** as the source bitmap for the resize. If the GPU → swap-chain → DWM legs haven't yet published the glyph-hidden frame, DWM grabs a stale frame that still contains the glyph and stretches/anchors it at the new window's top-left for one frame — the flash.

This is platform behavior, not something we can avoid by changing the IPC or the React code alone — the only lever we have is **time**: delay the `setBounds` call long enough that the glyph-hidden frame has reached the swap chain by the time DWM samples it.

## Current temporary fix

Two parts, both in `src/renderer/src/views/icon-view.tsx`:

### 1. Snap the glyph hidden synchronously

`handleSingleClick` wraps the state update in `flushSync` so React commits the `visibility: hidden` style on the same tick rather than batching it with a later effect:

```ts
flushSync(() => {
  setExpanding(true);
});
```

Removes one source of variance from the race.

We use `visibility: hidden` rather than unmounting / `display: none` so test queries against `icon-root` still resolve, and so a queued single-click whose `click` event arrives mid-expand still lands on a real element (the `expanding` gate in `handleSingleClick` short-circuits the duplicate expand). See the JSX comment at `icon-view.tsx:185-199`.

### 2. Triple `requestAnimationFrame` before the expand IPC

```ts
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      void window.glimpse?.expand();
    });
  });
});
```

- Two RAFs only covers React commit → paint. Empirically still flashes on busy machines.
- Three RAFs (~48 ms total) gives the GPU composite + swap-chain present a full extra frame to catch up. Empirically eliminates the residual flash.
- The ~16 ms cost stacks on top of the click classifier's existing 250 ms double-click wait, so it's not perceptible to the user.

## Why this is "temporary"

- It's tuned to current hardware. A slower machine, a heavier renderer commit, or contention from another GPU-bound app could still lose the race even with three RAFs.
- The fix is a delay, not a synchronization primitive. There is no signal from "swap-chain has presented the glyph-hidden frame" back to the renderer; we're just waiting long enough that it almost certainly has.
- A real fix would be one of:
  - **Defer `setBounds` until after a confirmed paint** — e.g. send the IPC from a `requestAnimationFrame` callback that itself fires after a swap-chain present callback (no such API in Electron today).
  - **Hide the window during the resize** — `iconWindow.hide()` → `setBounds` → `iconWindow.show()`. Avoids DWM sampling the stale surface entirely, but introduces a one-frame blank gap that may look worse than the flash.
  - **Render the expand animation main-side** with a separate "transition window" that owns the scale, freeing DWM from needing to source-bitmap the original icon window. Significant rework.

If the flash recurs in the wild on slower hardware, bump the RAF count to 4 as a stopgap and revisit the structural options above.

## References

- Source: `src/renderer/src/views/icon-view.tsx:34-86` (handleSingleClick + comments) and `:185-199` (JSX comment above the glyph wrapper).
- Plan: `.claude/plan/window.md` (expand / collapse animation behavior).

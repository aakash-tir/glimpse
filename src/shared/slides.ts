// Slide deck logic for the window mode panel.
//
// Plan/slides.md defines the 6-slide deck and the rules around dynamic
// visibility ("moon-phase slide and special-events slide can appear /
// disappear; the currently-viewed slide does not shift when others
// appear / disappear") and looping wrap ("right at last → first; left at
// first → last; same-direction wrap, no reverse-spin").
//
// The "no reverse-spin" rule is a *visual* concern handled in the
// SlideDeck component (rotateY direction follows the arrow click); this
// module only exposes the index math.

export type SlideId =
  | 'today'
  | 'seven-day'
  | 'current'
  | 'moon'
  | 'events'
  | 'settings';

// Canonical ordering. `moon` slots between `current` and `events`;
// `events` always sits immediately before `settings` (which is always
// last per plan/slides.md).
const SLIDE_ORDER: readonly SlideId[] = [
  'today',
  'seven-day',
  'current',
  'moon',
  'events',
  'settings',
] as const;

export type VisibilityFlags = {
  moonEnabled: boolean;
  eventsActive: boolean;
};

export function computeVisibleSlides(flags: VisibilityFlags): SlideId[] {
  return SLIDE_ORDER.filter((id) => {
    if (id === 'moon') return flags.moonEnabled;
    if (id === 'events') return flags.eventsActive;
    return true;
  });
}

export type WrapDirection = 'next' | 'prev';

export function wrapStep(
  currentIndex: number,
  length: number,
  direction: WrapDirection,
): number {
  if (length <= 0) return 0;
  if (direction === 'next') return (currentIndex + 1) % length;
  return (currentIndex - 1 + length) % length;
}

// When the visible-slide list changes (moon toggled, events become
// active / inactive), keep the user on the slide they were viewing.
// If that slide is no longer visible, fall back to the nearest preceding
// slide that is still in the list — the next-best stable choice that
// preserves "rough position" without jumping the user to slide 0.
export function reconcileCurrentSlideIndex(
  prevVisible: readonly SlideId[],
  prevIndex: number,
  nextVisible: readonly SlideId[],
): number {
  if (nextVisible.length === 0) return 0;
  const currentId = prevVisible[prevIndex];
  if (currentId === undefined) return 0;

  const directHit = nextVisible.indexOf(currentId);
  if (directHit !== -1) return directHit;

  for (let i = prevIndex - 1; i >= 0; i--) {
    const id = prevVisible[i];
    if (id === undefined) continue;
    const idx = nextVisible.indexOf(id);
    if (idx !== -1) return idx;
  }
  return 0;
}

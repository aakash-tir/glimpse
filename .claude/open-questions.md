# Open Questions

Unresolved decisions that affect implementation. Plan files are intentionally free of TBDs / TODOs — anything questionable lives here until answered.

> **Status (2026-05-03):** One open item — see *Onboarding step 5 needs a rework* below.

## Onboarding step 5 needs a rework

- **Context:** During M3 the title-bar **relocate** button (`CornerUpRight`) was removed; its function (collapse + reset icon to default top-right) was absorbed into the **minimize-to-icon** button. The plan/onboarding.md M9 tutorial dedicates step 5 to the relocate button as a discrete UI element ("Coachmark on the title-bar relocate button. Brief explanation that it resets the icon to default top-right."). With no separate relocate button, that step's anchor element no longer exists.
- **Options:**
  - **a)** Drop step 5 entirely — go from 7 steps to 6.
  - **b)** Merge "minimize button also relocates to default" into step 3 (icon ↔ window switching), since the minimize button is part of that transition discussion.
  - **c)** Keep step 5 but re-target it at the minimize button with a callout that distinguishes it from the weather-icon's in-place collapse ("Sun = leave it where the window was. Square = send it back to default.").
- **Recommendation:** (c). The behavioral split between weather-icon (in-place) and minimize (reset-to-default) is non-obvious and worth a dedicated tutorial moment — the relocate-step intent is preserved, just on a different glyph. Updating step counter / title-bar-force-visible logic is trivial.
- **Blocking:** M9 (first-launch onboarding). Not load-bearing for any earlier milestone.

## Format

When adding a new entry:

```markdown
## <Short title>

- **Context:** what surfaced the question.
- **Options:** the plausible answers (a, b, c…).
- **Recommendation:** which one I'd pick and why.
- **Blocking:** which milestone or task waits on this.
```

Resolved entries should be removed (and the answer reflected in the relevant `plan/` file), not left struck through.

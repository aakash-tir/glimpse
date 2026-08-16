# Glimpse — Project Instructions for Claude

**Glimpse** is a lightweight desktop weather app for Windows 11. Personal-use app — the source is public on GitHub (MIT), but no packaged binaries are distributed.

## Read order for new sessions

1. [`project-context.md`](./project-context.md) — what Glimpse is, target platform, design philosophy, constraints.
2. [`progress.md`](./progress.md) — milestones M0–M10 and current implementation status.
3. [`open-questions.md`](./open-questions.md) — unresolved decisions, if any.
4. [`rules/`](./rules/) — milestone workflow + per-milestone test inventory. Read before starting any implementation work.
5. [`plan/`](./plan/) — detailed specs by topic (load on demand based on what you're working on).

## Plan files (load only what's relevant)

| File | Use when working on… |
|---|---|
| [`plan/icon.md`](./plan/icon.md) | Icon (collapsed) state, drag mode, snap, loading & error visuals, hourly background refresh. |
| [`plan/window.md`](./plan/window.md) | Window expanded state, scale animation, resize, title bar, position persistence, drag-mode interactions. |
| [`plan/slides.md`](./plan/slides.md) | Slide content & layouts (hourly, 7-day, current, moon, events, settings), backgrounds, navigation, cube animation, dot indicator. |
| [`plan/onboarding.md`](./plan/onboarding.md) | First-launch tutorial — coachmarks, 8 steps, gesture animations, skip/replay/interrupt behavior. |
| [`plan/data-sources.md`](./plan/data-sources.md) | Open-Meteo, NOAA SWPC, SunCalc, meteor JSON, refresh policy, aurora filter, app-active, location. |
| [`plan/tech-stack.md`](./plan/tech-stack.md) | Electron + React + TS, deps, storage schema, single-instance lock, auto-launch, app icon. |
| [`plan/styling.md`](./plan/styling.md) | Tailwind + shadcn/ui, sunset accent palette, animations (Framer Motion), tooltips, theme behavior. |
| [`plan/packaging.md`](./plan/packaging.md) | Distribution phases (source vs installer), electron-builder NSIS config. |

## Rules files (process — always relevant when implementing)

| File | Purpose |
|---|---|
| [`rules/milestone-workflow.md`](./rules/milestone-workflow.md) | Branch-per-milestone, per-feature commits, end-of-milestone lint + typecheck + test gates, manual-test sign-off flow, merge + push, post-merge re-run. |
| [`rules/testing.md`](./rules/testing.md) | Test stack (Vitest + RTL + Playwright-electron), test layout, commands, **and the required automated tests per milestone (M0 – M10)**. |

## Hard project rules

- **Personal-use software.** No telemetry, no analytics, no public-distribution polish, no code signing.
- **Don't over-complicate.** Single Electron binary, single settings file, no backend, no caching layer.
- **Target platform: Windows 11 only.** Cross-platform is not a goal.
- **`plan/` is the source of truth.** When implementation diverges from a plan file, update the plan first, then write the code.
- **Open questions live in `open-questions.md` only.** Do not sprinkle TBD / TODO comments into `plan/` files.
- **Follow [`rules/milestone-workflow.md`](./rules/milestone-workflow.md) for every milestone.** Branch per milestone, per-feature commits, end-of-milestone lint + typecheck + automated tests, manual-test sign-off, merge with `--no-ff`, push both branches, re-run tests on `main`. Never delete a milestone branch.
- **Every milestone must ship the automated tests in [`rules/testing.md`](./rules/testing.md)** for that milestone. Tests carry forward — no regressions allowed.
- **Update `progress.md` on milestone completion.** When a milestone's "Definition of done" is met, mark it done with the date.

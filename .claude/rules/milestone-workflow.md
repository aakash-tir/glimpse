# Milestone workflow

End-to-end process for working through a milestone: branch creation → per-feature commits → end-of-milestone checks → manual sign-off → merge → post-merge verification. Applies to every milestone in [`progress.md`](../progress.md) (M0 – M10).

## Note on linters (ruff / mypy substitution)

The user originally specified `ruff` and `mypy`. Those are **Python-only** tools and Glimpse is a TypeScript + React + Electron app, so they don't apply to this codebase directly. The functional equivalents used here:

| Originally requested | Used here | What it does |
|---|---|---|
| `ruff check` | `eslint .` (`npm run lint`) | Lints TS/TSX/JS source. |
| `ruff format --check` | `prettier --check .` (`npm run format:check`) | Formatting check. |
| `mypy .` | `tsc --noEmit` (`npm run typecheck`) | Static type checking. |

If Python helper scripts are ever added to the repo (e.g. build tooling, data preprocessing), `ruff` and `mypy` should be added to lint *those*. Until then, the TypeScript equivalents above are the gates.

## Branch model

- **One branch per milestone.** Naming: `M<N>-<short-name>` (e.g. `M0-scaffold`, `M3-window-mode`, `M9-onboarding`).
- Branched off `main`.
- **Never delete the milestone branch** (local or remote) after merge — it stays as a permanent navigable record of the per-feature commits inside that milestone.

## Commits within a milestone

- **One commit per feature or sub-feature.** Don't batch multiple features into a single commit. Each commit should be a clean revert point.
- Commit subject: short, imperative ("Add icon hover scale", "Wire Open-Meteo client").
- Commit body: only when the *why* is non-obvious; reference the relevant `plan/` file when helpful.
- Commit immediately when a sub-feature is **functional + lint-clean + relevant unit tests pass**. Don't sit on uncommitted work across sub-features.
- This **overrides the default "only commit when explicitly asked"** behavior for the duration of milestone work — commit per sub-feature without re-confirmation. Stop and ask before any non-trivial git op beyond the commit (merge, rebase, force-push, branch deletion, cherry-pick).

## End-of-milestone checks

When all scope items in the active milestone's section of [`progress.md`](../progress.md) are implemented, run the following **in order** on the milestone branch. Every item must pass before requesting user sign-off.

1. **Lint:**
   - `npm run lint` (ESLint) — must be clean, zero warnings.
   - `npm run format:check` (Prettier) — must be clean.
2. **Type check:**
   - `npm run typecheck` (`tsc --noEmit`) — must be clean.
3. **Automated tests:**
   - `npm test` — runs all unit + component + integration + E2E tests for **this milestone and all prior milestones**. All must pass. See [`testing.md`](./testing.md) for the per-milestone test inventory.
4. **Generate `manual-tests.md`** at the project root. Overwrite the file completely (no carryover from previous milestone). Format defined below.
5. **Wait for user sign-off.** Both the automated test result AND the manual test list must be explicitly OK'd by the user before proceeding to merge. Do not merge unilaterally.

## Manual test file format

Write to `./manual-tests.md` at the project root. The file is gitignored (set up at M0 scaffolding) and personal — never committed. **Overwrite each milestone**, no carryover from the previous one.

````markdown
# Manual tests — M<N> <milestone name>

Steps to verify by hand. Skip anything already covered by the automated tests in `.claude/rules/testing.md` for this milestone — list only what the automated suite cannot reasonably exercise (visual quality, animations feeling right, real installer flows, real network behavior).

## Setup

- <preconditions, e.g. "delete %APPDATA%/Glimpse/settings.json to simulate first launch">

## Tests

### 1. <Short title>

- **Action:** <exact UI gesture or command>
- **Expected:** <what you should see / what should happen>

### 2. ...
````

If a milestone has no manual verification needed (purely structural or fully covered by automation), write a single-line file: `No manual tests required for this milestone.`

## Merge to main

After the user has signed off on **both** the automated tests and the manual tests:

1. **Confirm with the user before the merge.** Merging is non-trivial; do not run it without explicit go-ahead, even with prior sign-off on the tests.
2. `git checkout main`
3. `git pull --ff-only origin main` — make sure local `main` is current.
4. `git merge --no-ff M<N>-<name>` — `--no-ff` keeps the per-feature commits grouped under a single milestone merge commit on `main`.
5. `git push origin main`
6. `git push origin M<N>-<name>` — push the milestone branch too so remote has the per-feature history.
7. **Re-run the automated test suite on `main` post-merge** (`git checkout main && npm test`) — confirm nothing broke during the merge.

**Local and remote must match at the end of every milestone.** Both `main` and the milestone branch are pushed to `origin`. Verify:

- `git status` — clean working tree.
- `git log --oneline origin/main..main` — empty (no unpushed local commits).
- `git log --oneline origin/M<N>-<name>..M<N>-<name>` — empty.

## Wrap-up checklist

Once the merge + post-merge tests pass:

- [ ] Mark the milestone as **Done** in `.claude/progress.md` with the date.
- [ ] Clear `manual-tests.md` (overwrite with empty content — **do not delete the file**). The next milestone starts from a clean slate.
- [ ] Confirm `main` and the milestone branch are at matching commits on local + origin.
- [ ] **Do not delete the milestone branch** (local or remote). Permanent historical record.

## Failure handling

If anything fails during end-of-milestone checks:

- **Lint / typecheck failure:** fix on the milestone branch with a new commit. Do not skip with `--no-verify` or by silencing rules. Re-run from step 1.
- **Test failure:** fix on the milestone branch (either the test or the code, depending on which is wrong). New commit. Re-run from step 3.
- **Manual test rejection by user:** treat as a bug. Fix on the milestone branch with a new commit, regenerate `manual-tests.md`, re-request sign-off.
- **Post-merge test failure on `main`:** investigate the merge — likely a conflict resolved incorrectly or a missed dependency between milestones. Fix on `main` with a new commit (do not revert the merge unless absolutely necessary; it loses the per-feature history). Push the fix.

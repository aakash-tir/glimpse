# Distribution / packaging

Two phases. Phase 1 is dev-mode only; Phase 2 produces the actual installer the user will run.

## Phase 1 — current

- Run from source: `npm run dev`.
- No packaging, no installer, no auto-launch.
- Vite's HMR drives renderer reloads; Electron main re-launches on its own changes.

## Phase 2 — after the app is functional (M10)

Package with **electron-builder** targeting NSIS.

| Artifact | Name |
|---|---|
| Installer | `Glimpse Setup.exe` |
| Start-menu entry | `Glimpse` |
| Installed binary | `Glimpse.exe` |

- **App icon source:** `./app-icon.png` — replace the current 256 × 256 stopgap with a **1024 × 1024 export of the same artwork** before packaging for crisper Hi-DPI / Start-menu tile rendering. electron-builder generates the multi-resolution `.ico` automatically.
- **Auto-launch:** `app.setLoginItemSettings({ openAtLogin: true })` runs on the installed build's first launch. Disable via Windows Settings → Apps → Startup like any other app.
- **No code signing.** Personal use, single-machine install.
- **No auto-update infrastructure.** When the user wants a new build, they uninstall + reinstall.

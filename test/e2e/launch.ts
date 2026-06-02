// Shared Electron launch helpers for the E2E suite.
//
// By default the specs drive the electron-vite build output (`args: ['.']`)
// under the dev Electron binary — fast inner-loop, what `npm run test:e2e`
// uses. When GLIMPSE_E2E_PACKAGED=1 is set, the same specs instead drive
// the actual packaged binary at release/win-unpacked/Glimpse.exe — this is
// the M10 "all E2E pass on the production build" gate
// (`npm run test:e2e:packaged`, which builds the app first).
//
// Both targets read settings from %APPDATA%/Glimpse/settings.json (Windows
// is case-insensitive, so the dev app's lowercase getName() and the
// packaged productName resolve to the same folder), so the per-spec
// beforeEach profile setup is identical for either target.

import { _electron as electron } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

export const projectRoot = resolve(__dirname, '../..');

const packagedExe = resolve(
  projectRoot,
  'release',
  'win-unpacked',
  'Glimpse.exe',
);

/** True when the suite should target the packaged production binary. */
export const isPackagedTarget = process.env['GLIMPSE_E2E_PACKAGED'] === '1';

/** Launch Glimpse (dev output or packaged exe per GLIMPSE_E2E_PACKAGED). */
export async function launchGlimpse(): Promise<ElectronApplication> {
  if (isPackagedTarget) {
    // The packaged exe is the Electron binary with the app baked in —
    // launch it directly with no entry-point arg.
    return await electron.launch({
      executablePath: packagedExe,
      cwd: projectRoot,
    });
  }
  return await electron.launch({ args: ['.'], cwd: projectRoot });
}

/**
 * Spawn a *raw* second instance (not via Playwright) to exercise the
 * single-instance lock. Targets the same binary as launchGlimpse so the
 * lock is contended against the right process.
 */
export function spawnSecondInstance(): ChildProcess {
  if (isPackagedTarget) {
    return spawn(packagedExe, [], { cwd: projectRoot });
  }
  const electronBin = require('electron') as string;
  return spawn(electronBin, ['.'], { cwd: projectRoot });
}

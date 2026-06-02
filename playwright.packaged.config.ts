// Playwright config for the M10 "production build" gate: runs the exact
// same E2E specs, but against the packaged release/win-unpacked/Glimpse.exe
// instead of the electron-vite output. Setting the env flag here (rather
// than on the shell command line) keeps it cross-shell on Windows — the
// flag is re-applied when each Playwright worker re-loads this config,
// before the specs import ./launch and read it.
//
// Run via `npm run test:e2e:packaged`, which builds the unpacked app first.

process.env['GLIMPSE_E2E_PACKAGED'] = '1';

import baseConfig from './playwright.config';

export default baseConfig;

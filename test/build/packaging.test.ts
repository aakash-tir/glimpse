// M10 packaging gates (see .claude/rules/testing.md § M10).
//
// These verify the production build outputs, so the artifact-dependent
// checks run only after `npm run build:win` has populated release/. When
// release/ is absent (normal inner-loop dev) those checks are skipped so
// the default suite stays buildless; the source-asset check always runs.
//
// The M10 milestone gate is therefore:  npm run build:win && npm test
// (the build must precede the test run for the installer / .ico checks
// to actually assert rather than skip).

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const APP_ICON = resolve(ROOT, 'app-icon.png');
const INSTALLER = resolve(ROOT, 'release', 'Glimpse Setup.exe');
// The multi-resolution .ico we ship and point electron-builder at. v25
// only emits a single 256px entry when handed a PNG, so we pre-generate
// a proper multi-size .ico from the 1024 source and electron-builder
// embeds THAT into Glimpse.exe. See plan/packaging.md § App icon.
const APP_ICO = resolve(ROOT, 'app-icon.ico');

/** Read a PNG's pixel dimensions straight from its IHDR chunk. */
function pngSize(path: string): { width: number; height: number } {
  const buf = readFileSync(path);
  // 8-byte signature, then IHDR: width is a big-endian u32 at offset 16,
  // height at offset 20.
  const signature = buf.subarray(0, 8).toString('hex');
  expect(signature).toBe('89504e470d0a1a0a'); // valid PNG magic
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

/** Number of images packed into an .ico (the ICONDIR image count). */
function icoImageCount(path: string): number {
  const buf = readFileSync(path);
  expect(buf.readUInt16LE(0)).toBe(0); // reserved, always 0
  expect(buf.readUInt16LE(2)).toBe(1); // resource type 1 = icon
  return buf.readUInt16LE(4);
}

const hasInstaller = existsSync(INSTALLER);

describe('M10 packaging', () => {
  it('app-icon.png is the 1024×1024 export, not the 256×256 stopgap', () => {
    const { width, height } = pngSize(APP_ICON);
    expect({ width, height }).toEqual({ width: 1024, height: 1024 });
  });

  it.skipIf(!hasInstaller)(
    'produces the NSIS installer artifact with a plausible size',
    () => {
      const { size } = statSync(INSTALLER);
      // Electron + app + NSIS shell is tens of MB; guard against a
      // truncated / empty artifact without pinning an exact size.
      expect(size).toBeGreaterThan(30 * 1024 * 1024);
      expect(size).toBeLessThan(400 * 1024 * 1024);
    },
  );

  it('ships a multi-resolution .ico for electron-builder to embed', () => {
    // app-icon.ico carries 16/24/32/48/64/128/256 entries so Windows
    // renders crisply at every surface (taskbar, Start tile, Alt-Tab).
    const count = icoImageCount(APP_ICO);
    expect(count).toBeGreaterThan(1);
  });
});

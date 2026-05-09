import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_SETTINGS } from '../../src/shared/settings-store';
import {
  readSettingsFromFile,
  writeSettingsToFile,
} from '../../src/main/settings-fs';
import {
  defaultWindowBounds,
  expandFromIcon,
  resolveWindowBoundsForExpand,
} from '../../src/shared/window-position';
import {
  defaultIconPosition,
  type DisplayBounds,
} from '../../src/shared/icon-position';

const primary: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };

let tmp: string;
let file: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'glimpse-window-integration-'));
  file = join(tmp, 'settings.json');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// Mirrors the path the real main process takes on app start: read
// settings.json, resolve the window bounds against the current display
// layout, and write any updates back.
describe('Window bounds persistence + trackWindowPosition contract', () => {
  it('trackWindowPosition off: every expand uses the default expand-from-icon', () => {
    writeSettingsToFile(file, {
      ...DEFAULT_SETTINGS,
      trackWindowPosition: false,
      windowBounds: { x: 200, y: 200, width: 400, height: 400 },
    });
    const settings = readSettingsFromFile(file);
    const iconPos = defaultIconPosition(primary);
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: settings.trackWindowPosition,
      savedBounds: settings.windowBounds,
      allDisplays: [primary],
    });
    // Default-icon → default-window special case.
    expect(result).toEqual(defaultWindowBounds(primary));
  });

  it('trackWindowPosition on: expand uses last saved bounds', () => {
    const savedBounds = { x: 300, y: 300, width: 500, height: 500 };
    writeSettingsToFile(file, {
      ...DEFAULT_SETTINGS,
      trackWindowPosition: true,
      windowBounds: savedBounds,
    });
    const settings = readSettingsFromFile(file);
    const iconPos = { x: 800, y: 500 };
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: settings.trackWindowPosition,
      savedBounds: settings.windowBounds,
      allDisplays: [primary],
    });
    expect(result).toEqual(savedBounds);
  });

  it('trackWindowPosition on + tracked bounds off-screen: falls back to expand-from-icon', () => {
    const offScreen = { x: 2500, y: 100, width: 400, height: 400 };
    writeSettingsToFile(file, {
      ...DEFAULT_SETTINGS,
      trackWindowPosition: true,
      windowBounds: offScreen,
    });
    const settings = readSettingsFromFile(file);
    const iconPos = { x: 800, y: 500 };
    const result = resolveWindowBoundsForExpand({
      iconPos,
      primary,
      trackWindowPosition: settings.trackWindowPosition,
      savedBounds: settings.windowBounds,
      allDisplays: [primary],
    });
    expect(result).toEqual(expandFromIcon(iconPos, primary));
  });

  it('round-trips windowBounds across simulated restart', () => {
    // Launch 1: nothing saved.
    const launch1 = readSettingsFromFile(file);
    expect(launch1.windowBounds).toBeNull();
    expect(launch1.trackWindowPosition).toBe(false);

    // User enables tracking and resizes.
    writeSettingsToFile(file, {
      ...launch1,
      trackWindowPosition: true,
      windowBounds: { x: 100, y: 100, width: 400, height: 400 },
    });

    // Launch 2: tracking is restored.
    const launch2 = readSettingsFromFile(file);
    expect(launch2.trackWindowPosition).toBe(true);
    expect(launch2.windowBounds).toEqual({
      x: 100,
      y: 100,
      width: 400,
      height: 400,
    });
  });

  it('preserves other settings fields when windowBounds is updated', () => {
    writeSettingsToFile(file, {
      ...DEFAULT_SETTINGS,
      units: 'imperial',
      trackWindowPosition: true,
      iconPosition: { x: 200, y: 200 },
    });
    const launch1 = readSettingsFromFile(file);

    writeSettingsToFile(file, {
      ...launch1,
      windowBounds: { x: 50, y: 50, width: 300, height: 300 },
    });
    const launch2 = readSettingsFromFile(file);

    expect(launch2.windowBounds).toEqual({
      x: 50,
      y: 50,
      width: 300,
      height: 300,
    });
    expect(launch2.units).toBe('imperial');
    expect(launch2.iconPosition).toEqual({ x: 200, y: 200 });
    expect(launch2.trackWindowPosition).toBe(true);
  });
});

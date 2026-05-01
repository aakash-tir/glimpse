import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  readSettingsFromFile,
  writeSettingsToFile,
} from '../../src/shared/settings-store';
import {
  defaultIconPosition,
  resolveIconPosition,
  type DisplayBounds,
} from '../../src/shared/icon-position';

const primary: DisplayBounds = { x: 0, y: 0, width: 1920, height: 1080 };

let tmp: string;
let file: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'glimpse-integration-'));
  file = join(tmp, 'settings.json');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// Simulates the path the real main process takes on app start: read
// settings.json, resolve the icon position against the current display
// layout, and write any updates back. Persistence is verified across two
// "launches" (read → mutate → write → read).
describe('Icon position persistence across simulated restart', () => {
  it('round-trips a user-dragged position through settings.json', () => {
    // Launch 1: nothing saved yet, falls back to default top-right.
    const launch1 = readSettingsFromFile(file);
    const pos1 = resolveIconPosition(launch1.iconPosition, primary, [primary]);
    expect(pos1).toEqual(defaultIconPosition(primary));

    // User drags the icon to a custom spot — main process saves it.
    writeSettingsToFile(file, { ...launch1, iconPosition: { x: 800, y: 400 } });

    // Launch 2: should restore the saved position.
    const launch2 = readSettingsFromFile(file);
    expect(launch2.iconPosition).toEqual({ x: 800, y: 400 });
    const pos2 = resolveIconPosition(launch2.iconPosition, primary, [primary]);
    expect(pos2).toEqual({ x: 800, y: 400 });
  });

  it('falls back to default if the saved position is now off-screen', () => {
    // Saved on a (now-disconnected) larger display.
    writeSettingsToFile(file, { ...DEFAULT_SETTINGS, iconPosition: { x: 2500, y: 100 } });

    const launched = readSettingsFromFile(file);
    const resolved = resolveIconPosition(launched.iconPosition, primary, [primary]);
    expect(resolved).toEqual(defaultIconPosition(primary));
  });

  it('preserves other settings fields when iconPosition is updated', () => {
    writeSettingsToFile(file, {
      ...DEFAULT_SETTINGS,
      units: 'imperial',
      timeFormat: '12h',
      iconPosition: null,
    });
    const launch1 = readSettingsFromFile(file);
    writeSettingsToFile(file, { ...launch1, iconPosition: { x: 200, y: 50 } });

    const launch2 = readSettingsFromFile(file);
    expect(launch2.iconPosition).toEqual({ x: 200, y: 50 });
    expect(launch2.units).toBe('imperial');
    expect(launch2.timeFormat).toBe('12h');
  });
});

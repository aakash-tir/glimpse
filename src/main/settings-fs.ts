// File I/O for persisted settings. Lives in main/ rather than shared/
// so it never enters the renderer bundle (node:fs / node:path can't
// resolve in a browser context).
//
// Was previously inlined in shared/settings-store.ts, but commit-2 of
// the location-override series imported runtime helpers from that
// module into the renderer's Settings slide, which dragged the whole
// file (including node:fs imports) into the renderer bundle and
// broke the build. The split keeps shared/ pure-types-and-helpers.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  DEFAULT_SETTINGS,
  mergeWithDefaults,
  type Settings,
} from '../shared/settings-store';

export function readSettingsFromFile(filePath: string): Settings {
  let raw: unknown;
  try {
    const contents = readFileSync(filePath, 'utf-8');
    raw = JSON.parse(contents);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
  return mergeWithDefaults(raw);
}

export function writeSettingsToFile(
  filePath: string,
  settings: Settings,
): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

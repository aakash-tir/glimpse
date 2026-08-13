import { describe, it, expect } from 'vitest';
import {
  alertBackground,
  dedupeAlerts,
  alertSlideId,
  classifyAlertSeverity,
  dropExpired,
  hasWarning,
  severityLabel,
  sortAlerts,
  type WeatherAlert,
} from '../../src/shared/alerts';

function alert(over: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: 'a1',
    severity: 'watch',
    title: 'Severe thunderstorm watch',
    description: 'Conditions favourable for severe thunderstorms.',
    riskColour: 'yellow',
    expiresAtUtc: '2026-08-11T05:59:58.878Z',
    ...over,
  };
}

describe('classifyAlertSeverity', () => {
  it('maps the values Environment Canada actually emits', () => {
    expect(classifyAlertSeverity('warning')).toBe('warning');
    expect(classifyAlertSeverity('watch')).toBe('watch');
    expect(classifyAlertSeverity('advisory')).toBe('advisory');
    expect(classifyAlertSeverity('statement')).toBe('statement');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(classifyAlertSeverity('  WARNING ')).toBe('warning');
    expect(classifyAlertSeverity('Watch')).toBe('watch');
  });

  it('degrades an unknown type to the LEAST prominent severity', () => {
    // Deliberate: an unexpected upstream value must never be able to
    // promote itself to the front of the deck.
    expect(classifyAlertSeverity('emergency')).toBe('statement');
    expect(classifyAlertSeverity('')).toBe('statement');
    expect(classifyAlertSeverity(null)).toBe('statement');
    expect(classifyAlertSeverity(undefined)).toBe('statement');
    expect(classifyAlertSeverity(7)).toBe('statement');
  });
});

describe('hasWarning — drives promotion to the front of the deck', () => {
  it('is true when any alert is a warning', () => {
    expect(
      hasWarning([
        alert({ severity: 'watch' }),
        alert({ severity: 'warning' }),
      ]),
    ).toBe(true);
  });

  it('is false for watches, advisories and statements alone', () => {
    expect(
      hasWarning([
        alert({ severity: 'watch' }),
        alert({ severity: 'advisory' }),
        alert({ severity: 'statement' }),
      ]),
    ).toBe(false);
  });

  it('is false for an empty list', () => {
    expect(hasWarning([])).toBe(false);
  });
});

describe('sortAlerts', () => {
  it('orders most urgent first', () => {
    const sorted = sortAlerts([
      alert({ id: 's', severity: 'statement', title: 'S' }),
      alert({ id: 'w', severity: 'warning', title: 'W' }),
      alert({ id: 'a', severity: 'advisory', title: 'A' }),
      alert({ id: 'wa', severity: 'watch', title: 'B' }),
    ]);
    expect(sorted.map((a) => a.severity)).toEqual([
      'warning',
      'watch',
      'advisory',
      'statement',
    ]);
  });

  it('is alphabetical within a severity, so order is stable across refreshes', () => {
    const sorted = sortAlerts([
      alert({ id: '1', severity: 'warning', title: 'Wind warning' }),
      alert({ id: '2', severity: 'warning', title: 'Heat warning' }),
      alert({ id: '3', severity: 'warning', title: 'Snowfall warning' }),
    ]);
    expect(sorted.map((a) => a.title)).toEqual([
      'Heat warning',
      'Snowfall warning',
      'Wind warning',
    ]);
  });

  it('does not mutate its input', () => {
    const input = [
      alert({ id: '1', severity: 'statement' }),
      alert({ id: '2', severity: 'warning' }),
    ];
    sortAlerts(input);
    expect(input[0]?.severity).toBe('statement');
  });
});

describe('dropExpired', () => {
  const now = new Date('2026-08-11T00:00:00Z');

  it('drops alerts whose expiry has passed', () => {
    const out = dropExpired(
      [alert({ id: 'gone', expiresAtUtc: '2026-08-10T23:59:00Z' })],
      now,
    );
    expect(out).toHaveLength(0);
  });

  it('keeps alerts still in force', () => {
    const out = dropExpired(
      [alert({ id: 'live', expiresAtUtc: '2026-08-11T06:00:00Z' })],
      now,
    );
    expect(out).toHaveLength(1);
  });

  it('keeps open-ended alerts with no expiry', () => {
    expect(dropExpired([alert({ expiresAtUtc: null })], now)).toHaveLength(1);
  });

  it('keeps an alert whose expiry is unparseable rather than dropping it', () => {
    // Better a stale warning on screen than one silently discarded.
    expect(
      dropExpired([alert({ expiresAtUtc: 'not-a-date' })], now),
    ).toHaveLength(1);
  });
});

describe('presentation helpers', () => {
  it('builds a slide id from the alert id', () => {
    expect(alertSlideId(alert({ id: 'abc' }))).toBe('alert:abc');
  });

  it('labels each severity', () => {
    expect(severityLabel('warning')).toBe('Warning');
    expect(severityLabel('watch')).toBe('Watch');
    expect(severityLabel('advisory')).toBe('Advisory');
    expect(severityLabel('statement')).toBe('Statement');
  });

  it('derives the background from the MSC risk colour', () => {
    const yellow = alertBackground(alert({ riskColour: 'yellow' }));
    const orange = alertBackground(alert({ riskColour: 'orange' }));
    const red = alertBackground(alert({ riskColour: 'red' }));
    expect(new Set([yellow, orange, red]).size).toBe(3);
  });

  it('falls back to a neutral dark tint for an unknown or missing colour', () => {
    const fallback = alertBackground(alert({ riskColour: null }));
    expect(alertBackground(alert({ riskColour: 'chartreuse' }))).toBe(fallback);
    expect(fallback).toContain('#1b2436');
  });
});

describe('dedupeAlerts — one bulletin, many sub-regions', () => {
  // Environment Canada returns one feature per affected area, so a
  // single region-wide warning arrives several times with different ids
  // and slightly different body text.
  //
  // The expiries are NOT shared across the group — each sub-region's
  // bulletin is issued separately. Observed live for Kelowna: two "air
  // quality warning" features expiring at 10:17:07Z and 11:28:29Z, an
  // hour and eleven minutes apart. Keying dedupe on expiry (as it
  // originally did) therefore let the duplicates straight through.
  it('collapses same name + severity into one slide', () => {
    const out = dedupeAlerts([
      alert({
        id: 'fea1-2366',
        title: 'Air quality warning',
        severity: 'warning',
      }),
      alert({
        id: 'fea1-2367',
        title: 'Air quality warning',
        severity: 'warning',
      }),
      alert({
        id: 'fea1-2368',
        title: 'Air quality warning',
        severity: 'warning',
      }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('fea1-2366');
  });

  it('keeps genuinely different alerts apart', () => {
    const out = dedupeAlerts([
      alert({ id: '1', title: 'Air quality warning', severity: 'warning' }),
      alert({ id: '2', title: 'Heat warning', severity: 'warning' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('keeps the same name at different severities apart', () => {
    // A watch upgrading to a warning must not be swallowed.
    const out = dedupeAlerts([
      alert({ id: '1', title: 'Thunderstorm', severity: 'warning' }),
      alert({ id: '2', title: 'Thunderstorm', severity: 'watch' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('collapses the same bulletin even when the expiries differ', () => {
    // The live Kelowna case: one warning, two sub-regions, expiries an
    // hour apart. Before the fix this rendered as two identical slides.
    const out = dedupeAlerts([
      alert({
        id: 'fea1-2366',
        title: 'Air quality warning',
        severity: 'warning',
        riskColour: 'orange',
        expiresAtUtc: '2026-08-13T10:17:07.937Z',
      }),
      alert({
        id: 'fea1-2367',
        title: 'Air quality warning',
        severity: 'warning',
        riskColour: 'yellow',
        expiresAtUtc: '2026-08-13T11:28:29.207Z',
      }),
    ]);
    expect(out).toHaveLength(1);
    // First feature's content...
    expect(out[0]?.id).toBe('fea1-2366');
    expect(out[0]?.riskColour).toBe('orange');
    // ...but the group's latest expiry, so the merged alert lives as
    // long as the longest-running sub-region bulletin.
    expect(out[0]?.expiresAtUtc).toBe('2026-08-13T11:28:29.207Z');
  });

  it('takes the latest expiry regardless of feature order', () => {
    const out = dedupeAlerts([
      alert({ id: '1', expiresAtUtc: '2026-08-12T06:00:00Z' }),
      alert({ id: '2', expiresAtUtc: '2026-08-11T06:00:00Z' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('1');
    expect(out[0]?.expiresAtUtc).toBe('2026-08-12T06:00:00Z');
  });

  it('treats an open-ended expiry as the latest', () => {
    // A null expiry means the bulletin has no stated end, so it must
    // win over any timestamp rather than being sorted below it.
    const out = dedupeAlerts([
      alert({ id: '1', expiresAtUtc: '2026-08-11T06:00:00Z' }),
      alert({ id: '2', expiresAtUtc: null }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('1');
    expect(out[0]?.expiresAtUtc).toBeNull();
  });

  it('treats an unparseable expiry as open-ended, like dropExpired does', () => {
    const out = dedupeAlerts([
      alert({ id: '1', expiresAtUtc: '2026-08-11T06:00:00Z' }),
      alert({ id: '2', expiresAtUtc: 'not-a-date' }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.expiresAtUtc).toBe('not-a-date');
  });

  it('preserves first-seen order across distinct bulletins', () => {
    const out = dedupeAlerts([
      alert({ id: '1', title: 'Heat warning', severity: 'warning' }),
      alert({ id: '2', title: 'Air quality warning', severity: 'warning' }),
      alert({ id: '3', title: 'Heat warning', severity: 'warning' }),
    ]);
    expect(out.map((a) => a.title)).toEqual([
      'Heat warning',
      'Air quality warning',
    ]);
  });

  it('is case-insensitive on the title', () => {
    const out = dedupeAlerts([
      alert({ id: '1', title: 'Air quality warning' }),
      alert({ id: '2', title: 'AIR QUALITY WARNING' }),
    ]);
    expect(out).toHaveLength(1);
  });
});

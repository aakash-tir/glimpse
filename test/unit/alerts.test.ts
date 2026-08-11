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
  // single province-wide warning arrives three times with different ids
  // and slightly different body text. Observed live for Kelowna: three
  // "air quality warning" features sharing one bulletin id prefix and
  // one expiry.
  it('collapses same name + severity + expiry into one slide', () => {
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

  it('keeps the same name with different expiries apart', () => {
    const out = dedupeAlerts([
      alert({ id: '1', expiresAtUtc: '2026-08-11T06:00:00Z' }),
      alert({ id: '2', expiresAtUtc: '2026-08-12T06:00:00Z' }),
    ]);
    expect(out).toHaveLength(2);
  });

  it('is case-insensitive on the title', () => {
    const out = dedupeAlerts([
      alert({ id: '1', title: 'Air quality warning' }),
      alert({ id: '2', title: 'AIR QUALITY WARNING' }),
    ]);
    expect(out).toHaveLength(1);
  });
});

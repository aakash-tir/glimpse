// Severe-weather alert model and ordering.
//
// Pure — no Electron, no fetch. The MSC GeoJSON is parsed into this
// shape by main/data/msc-alerts.ts; the deck and the alert slide only
// ever see WeatherAlert.
//
// See plan/data-sources.md § Severe weather alerts and plan/slides.md
// § Severe weather alerts for the source, the Canada-only limitation,
// and the ordering rule.

/** Severity, most to least urgent. Drives ordering and promotion. */
export type AlertSeverity = 'warning' | 'watch' | 'advisory' | 'statement';

export type WeatherAlert = {
  /** Stable per-alert id, used to build the slide id. */
  id: string;
  severity: AlertSeverity;
  /** e.g. "Severe thunderstorm watch". */
  title: string;
  /** Body copy from the bulletin. */
  description: string;
  /** MSC risk colour ("yellow", "orange", …) or null when absent. */
  riskColour: string | null;
  /** ISO instant the alert lapses, or null when open-ended. */
  expiresAtUtc: string | null;
};

export type AlertSlideId = `alert:${string}`;

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  warning: 0,
  watch: 1,
  advisory: 2,
  statement: 3,
};

/**
 * Map MSC's `alert_type` onto our severity.
 *
 * Anything unrecognized degrades to `statement` — the *least* prominent
 * — deliberately. An unexpected upstream value must never be able to
 * promote itself to the front of the deck.
 */
export function classifyAlertSeverity(rawType: unknown): AlertSeverity {
  if (typeof rawType !== 'string') return 'statement';
  switch (rawType.trim().toLowerCase()) {
    case 'warning':
      return 'warning';
    case 'watch':
      return 'watch';
    case 'advisory':
      return 'advisory';
    default:
      return 'statement';
  }
}

/** True when at least one alert is a full warning. Drives promotion. */
export function hasWarning(alerts: readonly WeatherAlert[]): boolean {
  return alerts.some((a) => a.severity === 'warning');
}

/**
 * Most urgent first, then alphabetical by title within a severity so
 * the order is stable across refreshes (matching how the special-event
 * slides order within a day).
 */
export function sortAlerts(alerts: readonly WeatherAlert[]): WeatherAlert[] {
  return [...alerts].sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Expiry as a sortable instant, for picking the latest of a group.
 *
 * Null and unparseable expiries mean "no known end", which sorts after
 * every real timestamp — consistent with dropExpired(), which keeps
 * both rather than dropping an alert it cannot date.
 */
function expiryInstant(alert: WeatherAlert): number {
  if (alert.expiresAtUtc === null) return Infinity;
  const t = new Date(alert.expiresAtUtc).getTime();
  return Number.isNaN(t) ? Infinity : t;
}

/**
 * Collapse the same bulletin repeated across sub-regions.
 *
 * Environment Canada returns one feature per affected area, so a single
 * region-wide alert arrives as several features with the same name and
 * severity but different ids and slightly different body text.
 * Rendered naively that is three identical-looking slides for one
 * warning.
 *
 * Keyed on name + severity, keeping the first feature — which is the
 * one the deck would show anyway — but carrying the **latest** expiry
 * in the group, so the merged alert lives as long as the longest-
 * running sub-region bulletin instead of lapsing with the earliest.
 *
 * Expiry is deliberately not part of the key. It was originally, on the
 * assumption that sub-region bulletins share one expiry. Live data
 * disproved that — a Kelowna air-quality warning arrived as two
 * features whose expiries were an hour and eleven minutes apart,
 * because each sub-region's bulletin is issued separately — so keying
 * on it let the duplicates through. See plan/data-sources.md
 * § Severe weather alerts.
 */
export function dedupeAlerts(alerts: readonly WeatherAlert[]): WeatherAlert[] {
  const byKey = new Map<string, WeatherAlert>();
  const order: string[] = [];

  for (const a of alerts) {
    const key = `${a.title.toLowerCase()}|${a.severity}`;
    const kept = byKey.get(key);

    if (kept === undefined) {
      byKey.set(key, a);
      order.push(key);
      continue;
    }

    // Same bulletin again: keep the content already chosen, extend the
    // expiry if this sub-region's runs longer.
    if (expiryInstant(a) > expiryInstant(kept)) {
      byKey.set(key, { ...kept, expiresAtUtc: a.expiresAtUtc });
    }
  }

  return order.map((key) => byKey.get(key) as WeatherAlert);
}

/** Drop alerts whose expiry has passed. `now` is injectable for tests. */
export function dropExpired(
  alerts: readonly WeatherAlert[],
  now: Date,
): WeatherAlert[] {
  const t = now.getTime();
  return alerts.filter((a) => {
    if (a.expiresAtUtc === null) return true;
    const exp = new Date(a.expiresAtUtc).getTime();
    // An unparseable expiry keeps the alert — better a stale warning
    // than a silently dropped one.
    if (Number.isNaN(exp)) return true;
    return exp > t;
  });
}

export function alertSlideId(alert: WeatherAlert): AlertSlideId {
  return `alert:${alert.id}`;
}

/** Severity as displayed on the slide. */
export function severityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'warning':
      return 'Warning';
    case 'watch':
      return 'Watch';
    case 'advisory':
      return 'Advisory';
    case 'statement':
      return 'Statement';
  }
}

/**
 * Dark tint for the slide background, keyed off the MSC risk colour so
 * the app doesn't invent a severity palette of its own. Backgrounds
 * stay dark in both themes, like the event slides.
 */
export function alertBackground(alert: WeatherAlert): string {
  switch ((alert.riskColour ?? '').trim().toLowerCase()) {
    case 'red':
      return 'linear-gradient(160deg, #3b0a0a 0%, #240707 100%)';
    case 'orange':
      return 'linear-gradient(160deg, #3a1c05 0%, #241105 100%)';
    case 'yellow':
      return 'linear-gradient(160deg, #33290a 0%, #201905 100%)';
    default:
      return 'linear-gradient(160deg, #1b2436 0%, #101724 100%)';
  }
}

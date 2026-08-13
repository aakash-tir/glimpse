# Data sources

All four data sources are free and require no API key.

| Purpose | Source | Key |
|---|---|---|
| Forecast (hourly + 7-day), wind, humidity, feels-like, sunrise / sunset | **Open-Meteo** | None |
| Aurora visibility (Kp index, filtered by user latitude) | NOAA SWPC | None |
| Moon phase | Local astronomical calculation (SunCalc) | n/a |
| Eclipses | Static bundled JSON at `src/data/eclipses.json` (sourced from NASA catalog) | n/a |
| Meteor showers | Static bundled JSON of annual peak dates (sourced from IMO calendar) | n/a |

## Location

Resolution is a **3-tier priority chain** (see `src/shared/location-resolver.ts`), highest first:

1. **Manual override** — a user-entered city, gated by the Settings → *Advanced location* toggle (`advancedLocationEnabled`) and keyed to the IP-detected city it applies to (`locationOverrides`). Travel away → it goes dormant; travel back → it reactivates. The "look up by name" flow uses Open-Meteo's keyless geocoding API (`src/main/data/geocoding.ts`).
2. **Browser geolocation** — cached coordinates from `navigator.geolocation` (`browserGeolocation`), higher accuracy than IP. A **one-time permission prompt** is shown on first launch (`location-prompt.tsx`); `locationPermissionAsked` stops it re-appearing, and Settings offers "Re-ask location permission". No Google API key, no Windows Location Services.
3. **IP geolocation** — the always-available baseline. Auto-detected on every launch via `geojs.io` (keyless, HTTPS, ~city-level). Provider history/rationale live in the `src/main/data/geolocation.ts` header.

### Failure handling (location)

- On a successful IP detection the result is persisted to `cachedLocation`. If a later detection fails (rate limit / transient outage), the **cached location is reused** instead of dropping to the error state (`src/main/data/geolocation-cache.ts`).
- Only a first-ever launch with no cache surfaces a geolocation failure as the icon error state.
- All four data clients use a 10 s fetch timeout (`src/main/data/http.ts`) so a hung connection can't stall the refresh loop.

## Open-Meteo → icon mapping

Open-Meteo returns a WMO weather code per timestep. A constant lookup table in the codebase maps each code to the appropriate **`weather-icons`** name + day/night variant suffix.

Day vs night variant chosen by comparing the timestep against the user's local sunrise / sunset times.

## Aurora visibility filter

Show the aurora slide when the current Kp value crosses the threshold for the user's latitude:

| User latitude (absolute) | Show when |
|---|---|
| ≥ 60° | Kp ≥ 4 |
| 50° – 60° | Kp ≥ 5 |
| 40° – 50° | Kp ≥ 6 |
| < 40° | Kp ≥ 7 |

Visibility text on the slide is user-aware:

- If the user's latitude crosses the threshold band → "Visible from your location".
- Otherwise → "Visible at latitudes ≥ Nº" (where N is the threshold for the next-down band).

## Meteor shower data

- **File:** `src/data/meteor-showers.json`.
- **Schema per entry:** `{name, peakDate (YYYY-MM-DD), zhr, bestViewingTime, radiantConstellation}`.
- Bundled at build time, sourced from the IMO annual calendar.
- Refreshed at version bumps (a yearly lag is acceptable since major showers — Perseids, Geminids, Quadrantids — have stable peak dates).

## Eclipse data

- **File:** `src/data/eclipses.json`.
- Bundled at build time, sourced from the NASA eclipse catalog.
- SunCalc itself does not compute eclipses, hence the static catalog. Same yearly-lag tradeoff as meteor showers — major eclipse dates are well known years out, so refresh-at-version-bumps is fine.

## Severe weather alerts (Environment Canada)

**Source:** Meteorological Service of Canada, GeoMet-OGC-API — `https://api.weather.gc.ca/collections/weather-alerts/items`. GeoJSON, no API key, filtered to a small bounding box around the resolved location.

**Coverage is Canada only.** This is a deliberate limitation, not an oversight. Open-Meteo publishes no alerts product, and the free per-country feeds (MSC here, NWS for the US, MeteoAlarm for Europe) have unrelated shapes — supporting all three would roughly triple the work for places this app is not used from. Outside Canada the query simply returns nothing and the alert slides do not appear, which is the same behavior the special-event slides already have when there is no event.

**Fields consumed:** `alert_type` (drives severity), `alert_name_en` (title), `feature_name_en` (affected region), `risk_colour_en` (background tint), `expiration_datetime` (drop expired alerts), `status_en` (drop ended alerts).

`alert_text_en` is deliberately **not** consumed — see [`slides.md` § Severe weather alerts](./slides.md#severe-weather-alerts-conditional) for why the bulletin body has no place on a glance slide.

**Ended alerts are dropped at parse time.** `status_en` takes one of three values — `issued`, `continued`, `ended` (verified against all 179 live features nationwide). An `ended` bulletin is over, but its `expiration_datetime` can still be hours in the future, so the expiry filter alone does not catch it: a live Kelowna example had `status_en: "ended"` with an expiry 17 hours out. Roughly one in six live features nationwide is `ended`, so without this filter the deck shows warnings that have already finished.

**Severity** maps from `alert_type`: `warning` › `watch` › `advisory` › `statement`. Any unrecognized value degrades to `statement` — the least prominent — so an unexpected upstream type can never promote itself to the front of the deck.

**Deduplication.** MSC returns one feature per affected sub-region, so a single region-wide bulletin arrives several times: same name and severity, different ids, slightly different body text, and — observed live — **expiry timestamps up to an hour apart**, because each sub-region's bulletin is issued separately.

Duplicates collapse on **name + severity**, keeping the first feature's content and the **latest expiry** in the group, so the merged alert lives as long as the longest-running sub-region bulletin rather than vanishing when the earliest one lapses. A null or unparseable expiry counts as open-ended, and therefore as the latest.

The affected regions are **unioned** across the group rather than taking the first, since those features are genuinely different areas (a live case collapsed "North Okanagan" and "Central Okanagan") and dropping all but one would name the wrong place on the slide.

Expiry is deliberately **not** part of the key. It was originally, on the assumption that sub-region bulletins share one expiry; live data disproved that, and the result was one warning rendering as several near-identical slides — exactly what the dedupe exists to prevent.

`risk_colour_en` can also differ across the group (a live Kelowna air-quality warning arrived as both `orange` and `yellow`). The merged alert keeps the first feature's colour, which is what the deck would have shown anyway.

**Failure handling:** identical to NOAA. A failed alerts fetch silently hides the alert slides for the session and leaves every other data source untouched. Alerts are never allowed to put the icon into its error state — a warning feed being down is not a weather-fetch failure.

**Strictly passive.** Alerts are surfaced as slides only. No notification, no toast, no sound, no window-raise, no stealing focus — see [`slides.md` § Severe weather](./slides.md#severe-weather-alerts) for the ordering rule that gives a warning prominence without interrupting.

## Refresh policy

- **Schedule:** clock-aligned to **:05** of each hour.
- **On window open:** fetch all data immediately.
- **While window is open:** also follows the hourly schedule.
- **While icon is collapsed:** same hourly clock-aligned background fetch.
- **Sleep / wake:** if the device wakes after missing one or more refreshes, fire one immediate refresh and resume the schedule.

### Failure handling

- **General weather fetch fails** → icon switches to error state (sad cloud, no tooltip — see [icon.md § Error state](./icon.md#error-state-weather-fetch-failed); single-click is ignored while in error state). Retry on **exponential backoff doubling 5 → 10 → 20 → 40 → 60 min, capped at 1 h**, while the app is active. Backoff resets to 5 min only on a successful fetch.
- **Special-events fetch fails** → silently hide the special-events slide for this session.

## App-active definition

Used by retry / refresh logic. The app is "active" whenever its process is running — icon visible, window visible, or even on a different virtual desktop. Only inactive state: process not running.

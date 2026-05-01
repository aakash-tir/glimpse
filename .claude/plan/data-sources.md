# Data sources

All four data sources are free and require no API key.

| Purpose | Source | Key |
|---|---|---|
| Forecast (hourly + 7-day), wind, humidity, feels-like, sunrise / sunset | **Open-Meteo** | None |
| Aurora visibility (Kp index, filtered by user latitude) | NOAA SWPC | None |
| Moon phase, eclipses | Local astronomical calculation (SunCalc) | n/a |
| Meteor showers | Static bundled JSON of annual peak dates (sourced from IMO calendar) | n/a |

## Location

- Auto-detect via **IP geolocation** on every launch.
- ~city-level accuracy.
- No permission prompt, no Google API key, no Windows Location Services involvement.

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

## Refresh policy

- **Schedule:** clock-aligned to **:05** of each hour.
- **On window open:** fetch all data immediately.
- **While window is open:** also follows the hourly schedule.
- **While icon is collapsed:** same hourly clock-aligned background fetch.
- **Sleep / wake:** if the device wakes after missing one or more refreshes, fire one immediate refresh and resume the schedule.

### Failure handling

- **General weather fetch fails** → icon switches to error state (sad cloud + dark-glass hover tooltip "weather could not be determined"). Retry on **exponential backoff doubling 5 → 10 → 20 → 40 → 60 min, capped at 1 h**, while the app is active. Backoff resets to 5 min only on a successful fetch.
- **Special-events fetch fails** → silently hide the special-events slide for this session.

## App-active definition

Used by retry / refresh logic. The app is "active" whenever its process is running — icon visible, window visible, or even on a different virtual desktop. Only inactive state: process not running.

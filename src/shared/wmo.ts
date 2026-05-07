import type { Condition } from './condition';

// Open-Meteo returns a WMO weather interpretation code per timestep.
// Reference: https://open-meteo.com/en/docs (Weather Variable Documentation).
// Every code listed in the docs is mapped here; unknown codes fall back
// to 'cloudy' (a safe neutral) so a malformed response never crashes the
// renderer. The full set is also exported as WMO_CODES for parameterized
// tests.

export const WMO_CODES: readonly number[] = [
  0, // Clear sky
  1, // Mainly clear
  2, // Partly cloudy
  3, // Overcast
  45, // Fog
  48, // Depositing rime fog
  51, // Drizzle: light
  53, // Drizzle: moderate
  55, // Drizzle: dense
  56, // Freezing drizzle: light
  57, // Freezing drizzle: dense
  61, // Rain: slight
  63, // Rain: moderate
  65, // Rain: heavy
  66, // Freezing rain: light
  67, // Freezing rain: heavy
  71, // Snow: slight
  73, // Snow: moderate
  75, // Snow: heavy
  77, // Snow grains
  80, // Rain showers: slight
  81, // Rain showers: moderate
  82, // Rain showers: violent
  85, // Snow showers: slight
  86, // Snow showers: heavy
  95, // Thunderstorm: slight or moderate
  96, // Thunderstorm with slight hail
  99, // Thunderstorm with heavy hail
] as const;

export function wmoToCondition(code: number): Condition {
  switch (code) {
    case 0:
    case 1:
      return 'clear';
    case 2:
      return 'partly-cloudy';
    case 3:
      return 'cloudy';
    case 45:
    case 48:
      return 'fog';
    case 51:
    case 53:
    case 55:
      return 'drizzle';
    case 56:
    case 57:
    case 66:
    case 67:
      return 'sleet';
    case 61:
    case 63:
    case 65:
    case 80:
    case 81:
    case 82:
      return 'rain';
    case 71:
    case 73:
    case 75:
    case 77:
    case 85:
    case 86:
      return 'snow';
    case 95:
    case 96:
    case 99:
      return 'thunderstorm';
    default:
      return 'cloudy';
  }
}

// Open-Meteo forecast client.
//
// Endpoint:
//   https://api.open-meteo.com/v1/forecast
//
// Per plan/data-sources.md the forecast slides need: hourly + daily
// arrays, wind, humidity, feels-like, sunrise / sunset, current
// weather code. We ask Open-Meteo for everything in a single call with
// `timezone=auto` so timestamps are returned in the user's local zone
// (matters for the day/night icon variant pick at each timestep, and
// for the 12 h / 24 h Settings toggle).
//
// The internal Forecast shape decouples the rest of the codebase from
// Open-Meteo's exact response: each timestep already carries the
// resolved Condition (via wmoToCondition) so renderer code never has
// to look up WMO codes itself.

import type {
  Forecast,
  ForecastCurrent,
  ForecastDay,
  ForecastHour,
} from '../../shared/forecast';
import { wmoToCondition } from '../../shared/wmo';
import { fetchWithTimeout } from './http';

export type {
  Forecast,
  ForecastCurrent,
  ForecastDay,
  ForecastHour,
} from '../../shared/forecast';

const BASE = 'https://api.open-meteo.com/v1/forecast';

export type Fetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

const defaultFetcher: Fetcher = (url) =>
  fetchWithTimeout(url).then((res) => ({
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<unknown>,
  }));

export function buildForecastUrl(input: {
  latitude: number;
  longitude: number;
}): string {
  const params = new URLSearchParams({
    latitude: input.latitude.toString(),
    longitude: input.longitude.toString(),
    timezone: 'auto',
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'precipitation_probability',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
    ].join(','),
  });
  return `${BASE}?${params.toString()}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function arrField<T>(
  src: Record<string, unknown>,
  key: string,
  pred: (v: unknown) => v is T,
): T[] {
  const arr = src[key];
  if (!Array.isArray(arr)) {
    throw new Error(`open-meteo: expected array at ${key}`);
  }
  for (const item of arr) {
    if (!pred(item)) {
      throw new Error(
        `open-meteo: invalid item in ${key}: ${JSON.stringify(item)}`,
      );
    }
  }
  return arr as T[];
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
// Open-Meteo returns null for some optional fields (e.g.
// precipitation_probability for very-near-future timesteps in some
// regions). Coerce nulls to 0 in the parser; here we accept both.
const isNullableNumber = (v: unknown): v is number | null =>
  v === null || isNumber(v);

function num(v: unknown, fieldName: string): number {
  if (!isNumber(v)) {
    throw new Error(`open-meteo: expected number at ${fieldName}`);
  }
  return v;
}

function str(v: unknown, fieldName: string): string {
  if (!isString(v)) {
    throw new Error(`open-meteo: expected string at ${fieldName}`);
  }
  return v;
}

export function parseForecast(raw: unknown): Forecast {
  if (!isPlainObject(raw)) {
    throw new Error('open-meteo: response was not a JSON object');
  }
  const timezone = str(raw['timezone'], 'timezone');

  const currentRaw = raw['current'];
  if (!isPlainObject(currentRaw)) {
    throw new Error('open-meteo: missing current block');
  }
  const currentWeatherCode = num(
    currentRaw['weather_code'],
    'current.weather_code',
  );
  const current: ForecastCurrent = {
    time: str(currentRaw['time'], 'current.time'),
    temperature: num(currentRaw['temperature_2m'], 'current.temperature_2m'),
    apparentTemperature: num(
      currentRaw['apparent_temperature'],
      'current.apparent_temperature',
    ),
    humidity: num(
      currentRaw['relative_humidity_2m'],
      'current.relative_humidity_2m',
    ),
    weatherCode: currentWeatherCode,
    condition: wmoToCondition(currentWeatherCode),
    windSpeed: num(currentRaw['wind_speed_10m'], 'current.wind_speed_10m'),
    windDirection: num(
      currentRaw['wind_direction_10m'],
      'current.wind_direction_10m',
    ),
    precipitation: num(currentRaw['precipitation'], 'current.precipitation'),
  };

  const hourlyRaw = raw['hourly'];
  if (!isPlainObject(hourlyRaw)) {
    throw new Error('open-meteo: missing hourly block');
  }
  const hourlyTimes = arrField(hourlyRaw, 'time', isString);
  const hourlyTemps = arrField(hourlyRaw, 'temperature_2m', isNumber);
  const hourlyCodes = arrField(hourlyRaw, 'weather_code', isNumber);
  const hourlyPops = arrField(
    hourlyRaw,
    'precipitation_probability',
    isNullableNumber,
  );
  const hourlyLen = hourlyTimes.length;
  if (
    hourlyTemps.length !== hourlyLen ||
    hourlyCodes.length !== hourlyLen ||
    hourlyPops.length !== hourlyLen
  ) {
    throw new Error('open-meteo: hourly arrays mismatched length');
  }
  const hourly: ForecastHour[] = [];
  for (let i = 0; i < hourlyLen; i++) {
    const code = hourlyCodes[i]!;
    hourly.push({
      time: hourlyTimes[i]!,
      temperature: hourlyTemps[i]!,
      weatherCode: code,
      condition: wmoToCondition(code),
      precipitationProbability: hourlyPops[i] ?? 0,
    });
  }

  const dailyRaw = raw['daily'];
  if (!isPlainObject(dailyRaw)) {
    throw new Error('open-meteo: missing daily block');
  }
  const dailyDates = arrField(dailyRaw, 'time', isString);
  const dailyCodes = arrField(dailyRaw, 'weather_code', isNumber);
  const dailyHighs = arrField(dailyRaw, 'temperature_2m_max', isNumber);
  const dailyLows = arrField(dailyRaw, 'temperature_2m_min', isNumber);
  const dailyPops = arrField(
    dailyRaw,
    'precipitation_probability_max',
    isNullableNumber,
  );
  const dailySunrises = arrField(dailyRaw, 'sunrise', isString);
  const dailySunsets = arrField(dailyRaw, 'sunset', isString);
  const dailyLen = dailyDates.length;
  if (
    dailyCodes.length !== dailyLen ||
    dailyHighs.length !== dailyLen ||
    dailyLows.length !== dailyLen ||
    dailyPops.length !== dailyLen ||
    dailySunrises.length !== dailyLen ||
    dailySunsets.length !== dailyLen
  ) {
    throw new Error('open-meteo: daily arrays mismatched length');
  }
  const daily: ForecastDay[] = [];
  for (let i = 0; i < dailyLen; i++) {
    const code = dailyCodes[i]!;
    daily.push({
      date: dailyDates[i]!,
      weatherCode: code,
      condition: wmoToCondition(code),
      high: dailyHighs[i]!,
      low: dailyLows[i]!,
      precipitationProbability: dailyPops[i] ?? 0,
      sunrise: dailySunrises[i]!,
      sunset: dailySunsets[i]!,
    });
  }

  return { timezone, current, hourly, daily };
}

export async function fetchForecast(
  input: { latitude: number; longitude: number },
  fetcher: Fetcher = defaultFetcher,
): Promise<Forecast> {
  const url = buildForecastUrl(input);
  const res = await fetcher(url);
  if (!res.ok) {
    throw new Error(`open-meteo: HTTP ${res.status}`);
  }
  const raw = await res.json();
  return parseForecast(raw);
}

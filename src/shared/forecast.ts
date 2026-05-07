// Internal Forecast shape consumed by both the main process (which
// fetches and parses Open-Meteo) and the renderer (which subscribes to
// snapshots over IPC). Each timestep already carries the resolved
// Condition so renderer code never has to look up WMO codes itself.

import type { Condition } from './condition';

export type ForecastCurrent = {
  /** Local time (zone implied by Forecast.timezone) "YYYY-MM-DDTHH:mm". */
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  weatherCode: number;
  condition: Condition;
  windSpeed: number;
  /** Wind direction in degrees (0 = N, 90 = E). */
  windDirection: number;
  precipitation: number;
};

export type ForecastHour = {
  time: string;
  temperature: number;
  weatherCode: number;
  condition: Condition;
  precipitationProbability: number;
};

export type ForecastDay = {
  /** Local calendar date "YYYY-MM-DD". */
  date: string;
  weatherCode: number;
  condition: Condition;
  high: number;
  low: number;
  precipitationProbability: number;
  /** Local-zone "YYYY-MM-DDTHH:mm" sunrise / sunset times. */
  sunrise: string;
  sunset: string;
};

export type Forecast = {
  /** IANA timezone string returned by the API (e.g. America/Los_Angeles). */
  timezone: string;
  current: ForecastCurrent;
  hourly: ForecastHour[];
  daily: ForecastDay[];
};

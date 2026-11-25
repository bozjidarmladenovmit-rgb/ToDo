import type { Place } from './types';

/** Rain chance (%) at which the user is told to take an umbrella and leave a bit earlier. */
export const RAIN_THRESHOLD = 50;
/** Extra minutes added to the travel time when rain is likely. */
export const RAIN_EXTRA_MINUTES = 5;
/** Open-Meteo forecasts up to 16 days ahead. */
const FORECAST_DAYS = 16;

/** Hourly rain probability, keyed by local "YYYY-MM-DDTHH:00". */
export type HourlyRain = Record<string, number>;

const pad = (n: number) => String(n).padStart(2, '0');
export function hourKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export function parseOpenMeteo(json: unknown): HourlyRain {
  const hourly = (json as { hourly?: { time?: unknown; precipitation_probability?: unknown } })?.hourly;
  const times = hourly?.time;
  const probs = hourly?.precipitation_probability;
  const out: HourlyRain = {};
  if (!Array.isArray(times) || !Array.isArray(probs)) return out;
  times.forEach((t, i) => {
    const p = probs[i];
    if (typeof t === 'string' && typeof p === 'number') out[t] = p;
  });
  return out;
}

/**
 * Free forecast from Open-Meteo (no key needed). Times come back in the place's local time zone,
 * which matches the phone's clock for nearby places.
 */
export async function fetchHourlyRain(place: Place): Promise<HourlyRain> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${place.lat.toFixed(3)}&longitude=${place.lng.toFixed(3)}` +
    `&hourly=precipitation_probability&forecast_days=${FORECAST_DAYS}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  return parseOpenMeteo(await res.json());
}

export function rainChanceAt(rain: HourlyRain | undefined, at: Date): number | undefined {
  return rain?.[hourKey(at)];
}

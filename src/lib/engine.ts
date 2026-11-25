/**
 * The work that keeps notifications correct: fresh travel times, the weather forecast and the
 * notification schedule. Used by the app while it is open and by the background task when it is not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { nextOccurrence } from './schedule';
import { travelMinutes } from './travel';
import type { Place, Reminder, Settings, ShoppingItem } from './types';
import { fetchHourlyRain, HourlyRain, RAIN_EXTRA_MINUTES, RAIN_THRESHOLD, rainChanceAt } from './weather';

export const KEYS = {
  reminders: 'data.reminders.v1',
  shopping: 'data.shopping.v1',
  settings: 'data.settings.v1',
  done: 'data.done.v1',
  weather: 'cache.weather.v1',
  language: 'settings.language',
};

export const DEFAULT_SETTINGS: Settings = { defaultTravelMode: 'drive' };

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): Promise<void> {
  return AsyncStorage.setItem(key, JSON.stringify(value));
}

export interface AppData {
  reminders: Reminder[];
  shopping: ShoppingItem[];
  settings: Settings;
  done: string[];
  weather: WeatherCache;
}

export async function loadAll(): Promise<AppData> {
  const [reminders, shopping, settings, done, weather] = await Promise.all([
    loadJSON<Reminder[]>(KEYS.reminders, []),
    loadJSON<ShoppingItem[]>(KEYS.shopping, []),
    loadJSON<Settings>(KEYS.settings, DEFAULT_SETTINGS),
    loadJSON<string[]>(KEYS.done, []),
    loadJSON<WeatherCache>(KEYS.weather, {}),
  ]);
  return { reminders, shopping, settings: { ...DEFAULT_SETTINGS, ...settings }, done, weather };
}

// ---------------------------------------------------------------- travel

const HOUR = 3_600_000;
/** Within this window before an event the phone's current position is used as the starting point. */
const USE_CURRENT_POSITION_WITHIN = 3 * HOUR;

/** How stale an automatic travel time may get before it is recalculated (closer events refresh more often). */
function maxAge(msUntilEvent: number): number {
  if (msUntilEvent < 3 * HOUR) return 10 * 60_000;
  if (msUntilEvent < 24 * HOUR) return HOUR;
  return 12 * HOUR;
}

/** Current position, but only if the user already allowed location: never prompts. */
export async function currentPlace(): Promise<Place | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted) return undefined;
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { label: '', lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return undefined;
  }
}

/**
 * Recalculates automatic travel times that are getting old. Returns the updated list,
 * or null when nothing changed.
 */
export async function refreshTravel(reminders: Reminder[], settings: Settings, now = new Date()): Promise<Reminder[] | null> {
  let here: Place | undefined | null = null; // null = not looked up yet
  let changed = false;
  const out: Reminder[] = [];

  for (const r of reminders) {
    const next = r.enabled && r.travelAuto && r.place ? nextOccurrence(r, now) : undefined;
    if (!next || !r.place || next.getTime() - now.getTime() > 14 * 24 * HOUR) {
      out.push(r);
      continue;
    }
    const until = next.getTime() - now.getTime();
    const age = r.travelComputedAt ? now.getTime() - new Date(r.travelComputedAt).getTime() : Infinity;
    if (age < maxAge(until) && r.travelMinutes !== undefined) {
      out.push(r);
      continue;
    }
    let origin = settings.home;
    if (until < USE_CURRENT_POSITION_WITHIN) {
      if (here === null) here = await currentPlace();
      origin = here ?? origin;
    }
    if (!origin) {
      out.push(r);
      continue;
    }
    try {
      const res = await travelMinutes(origin, r.place, r.travelMode ?? settings.defaultTravelMode, next);
      out.push({ ...r, travelMinutes: res.minutes, travelSource: res.source, travelComputedAt: now.toISOString() });
      changed = true;
    } catch {
      out.push(r);
    }
  }
  return changed ? out : null;
}

// ---------------------------------------------------------------- weather

export type WeatherCache = Record<string, { fetchedAt: string; rain: HourlyRain }>;
const WEATHER_MAX_AGE = 3 * HOUR;

/** Places close together share one forecast (about 1 km grid). */
export function placeKey(p: Place): string {
  return `${p.lat.toFixed(2)},${p.lng.toFixed(2)}`;
}

/** Fetches forecasts for every place with an upcoming event. Returns the new cache, or null when nothing changed. */
export async function refreshWeather(reminders: Reminder[], cache: WeatherCache, now = new Date()): Promise<WeatherCache | null> {
  const places = new Map<string, Place>();
  for (const r of reminders) {
    if (!r.enabled || !r.place || !(r.travelMinutes ?? 0)) continue;
    const next = nextOccurrence(r, now);
    if (next && next.getTime() - now.getTime() < 16 * 24 * HOUR) places.set(placeKey(r.place), r.place);
  }
  const fresh: WeatherCache = {};
  let changed = false;
  for (const [key, place] of places) {
    const old = cache[key];
    if (old && now.getTime() - new Date(old.fetchedAt).getTime() < WEATHER_MAX_AGE) {
      fresh[key] = old;
      continue;
    }
    try {
      fresh[key] = { fetchedAt: now.toISOString(), rain: await fetchHourlyRain(place) };
      changed = true;
    } catch {
      if (old) fresh[key] = old;
    }
  }
  // Also counts as a change when old places dropped out of the cache.
  if (Object.keys(cache).length !== Object.keys(fresh).length) changed = true;
  return changed ? fresh : null;
}

export function rainChanceFor(cache: WeatherCache, reminder: Reminder, at: Date): number | undefined {
  if (!reminder.place) return undefined;
  return rainChanceAt(cache[placeKey(reminder.place)]?.rain, at);
}

export function isRainy(cache: WeatherCache, reminder: Reminder, at: Date): boolean {
  return (rainChanceFor(cache, reminder, at) ?? 0) >= RAIN_THRESHOLD;
}

export function rainExtraMinutes(cache: WeatherCache) {
  return (r: Reminder, at: Date) => (isRainy(cache, r, at) ? RAIN_EXTRA_MINUTES : 0);
}

/** Done-marks older than two days are no longer needed. */
export function pruneDone(done: string[], now = new Date()): string[] {
  const cutoff = now.getTime() - 2 * 24 * HOUR;
  return done.filter((k) => new Date(k.split('|')[1]).getTime() >= cutoff);
}

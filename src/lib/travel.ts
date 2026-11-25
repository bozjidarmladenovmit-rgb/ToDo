import type { Place, TravelMode, TravelSource } from './types';

/**
 * Google Maps key for the Routes API. Put it in a `.env` file as
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=... (see README). Without it the app falls back to an estimate.
 */
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface TravelResult {
  minutes: number;
  source: TravelSource;
}

const GOOGLE_MODES: Record<TravelMode, string> = {
  drive: 'DRIVE',
  walk: 'WALK',
  bike: 'BICYCLE',
  transit: 'TRANSIT',
};

/** Average door-to-door speeds (km/h) for the estimate, tuned for city travel. */
const ESTIMATE_KMH: Record<TravelMode, number> = { drive: 30, walk: 4.8, bike: 14, transit: 18 };
/** Roads are rarely straight: real distance is about 1.3× the straight line in cities. */
const DETOUR = 1.3;
/** Parking, waiting for the bus, and so on. */
const FIXED_OVERHEAD: Record<TravelMode, number> = { drive: 3, walk: 0, bike: 1, transit: 5 };

export function distanceKm(a: Place, b: Place): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function estimateMinutes(from: Place, to: Place, mode: TravelMode): number {
  const km = distanceKm(from, to) * DETOUR;
  return Math.max(1, Math.ceil((km / ESTIMATE_KMH[mode]) * 60 + FIXED_OVERHEAD[mode]));
}

/** Parses Google's duration format, e.g. "1234s". */
export function parseGoogleDuration(d: unknown): number | undefined {
  if (typeof d !== 'string') return undefined;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d);
  return m ? Math.max(1, Math.ceil(Number(m[1]) / 60)) : undefined;
}

async function googleMinutes(from: Place, to: Place, mode: TravelMode, arriveAt: Date): Promise<number | undefined> {
  const body: Record<string, unknown> = {
    origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
    destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
    travelMode: GOOGLE_MODES[mode],
  };
  if (mode === 'drive') {
    // Traffic-aware routing needs a departure time in the future; use a rough guess of when the user leaves.
    const leaveGuess = new Date(Math.max(Date.now() + 60_000, arriveAt.getTime() - estimateMinutes(from, to, mode) * 60_000));
    body.routingPreference = 'TRAFFIC_AWARE';
    body.departureTime = leaveGuess.toISOString();
  } else if (mode === 'transit' && arriveAt.getTime() > Date.now()) {
    body.arrivalTime = arriveAt.toISOString();
  }
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY!,
      'X-Goog-FieldMask': 'routes.duration',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}`);
  const json = await res.json();
  return parseGoogleDuration(json?.routes?.[0]?.duration);
}

/** Travel time from `from` to `to`, arriving at `arriveAt`. Uses Google when a key is set, otherwise an estimate. */
export async function travelMinutes(from: Place, to: Place, mode: TravelMode, arriveAt: Date): Promise<TravelResult> {
  if (GOOGLE_KEY) {
    try {
      const m = await googleMinutes(from, to, mode, arriveAt);
      if (m !== undefined) return { minutes: m, source: 'google' };
    } catch (e) {
      console.warn('Google travel time failed, using estimate', e);
    }
  }
  return { minutes: estimateMinutes(from, to, mode), source: 'estimate' };
}

export const hasGoogleKey = Boolean(GOOGLE_KEY);

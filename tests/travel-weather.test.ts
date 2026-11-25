import assert from 'node:assert/strict';
import { test } from 'node:test';

import { distanceKm, estimateMinutes, parseGoogleDuration, travelMinutes } from '../src/lib/travel.ts';
import { hourKey, parseOpenMeteo, rainChanceAt } from '../src/lib/weather.ts';

// Skopje centre (Ploshtad Makedonija) and the City Park area, about 2 km apart.
const centre = { label: 'centre', lat: 41.9961, lng: 21.4316 };
const park = { label: 'park', lat: 42.0054, lng: 21.4106 };

test('distance between two Skopje points is about 2 km', () => {
  const km = distanceKm(centre, park);
  assert.ok(km > 1.8 && km < 2.2, String(km));
});

test('estimate is sensible per travel mode', () => {
  const drive = estimateMinutes(centre, park, 'drive');
  const walk = estimateMinutes(centre, park, 'walk');
  assert.ok(drive >= 5 && drive <= 12, `drive ${drive}`);
  assert.ok(walk >= 25 && walk <= 40, `walk ${walk}`);
  assert.equal(estimateMinutes(centre, centre, 'walk'), 1);
});

test('without a Google key the estimate is used', async () => {
  const r = await travelMinutes(centre, park, 'drive', new Date(Date.now() + 3_600_000));
  assert.equal(r.source, 'estimate');
});

test('Google duration parsing', () => {
  assert.equal(parseGoogleDuration('900s'), 15);
  assert.equal(parseGoogleDuration('901s'), 16);
  assert.equal(parseGoogleDuration('12.5s'), 1);
  assert.equal(parseGoogleDuration(undefined), undefined);
  assert.equal(parseGoogleDuration('15 min'), undefined);
});

test('Open-Meteo hourly parsing and lookup', () => {
  const rain = parseOpenMeteo({
    hourly: { time: ['2026-12-01T09:00', '2026-12-01T10:00'], precipitation_probability: [20, 80] },
  });
  assert.equal(rainChanceAt(rain, new Date(2026, 11, 1, 10, 45)), 80);
  assert.equal(rainChanceAt(rain, new Date(2026, 11, 1, 11, 0)), undefined);
  assert.equal(hourKey(new Date(2026, 0, 5, 7, 59)), '2026-01-05T07:00');
  assert.deepEqual(parseOpenMeteo({}), {});
  assert.deepEqual(parseOpenMeteo(null), {});
});

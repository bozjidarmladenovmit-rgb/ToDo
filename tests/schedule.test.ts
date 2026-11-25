import assert from 'node:assert/strict';
import { test } from 'node:test';

import { alertsForOccurrence, occurrencesBetween, planAlerts, MAX_SCHEDULED } from '../src/lib/schedule.ts';
import type { Reminder } from '../src/lib/types.ts';

const base = (over: Partial<Reminder>): Reminder => ({
  id: 'r1',
  title: 'Training',
  category: 'sport',
  startAt: new Date(2026, 11, 1, 10, 0).toISOString(), // Tue 1 Dec 2026, 10:00
  repeat: { kind: 'none' },
  enabled: true,
  createdAt: new Date(2026, 10, 1).toISOString(),
  ...over,
});
const day = (d: number, h = 0, m = 0) => new Date(2026, 11, d, h, m);
const hm = (d: Date) => `${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

test('one-off reminder appears only inside the window', () => {
  assert.equal(occurrencesBetween(base({}), day(1), day(2)).length, 1);
  assert.equal(occurrencesBetween(base({}), day(2), day(5)).length, 0);
});

test('prep + travel gives prepare / leave / start alerts (user example)', () => {
  const r = base({ prepMinutes: 10, travelMinutes: 15 });
  const alerts = alertsForOccurrence(r, day(1, 10));
  assert.deepEqual(alerts.map((a) => [a.kind, hm(a.fireAt)]), [
    ['prepare', '1 9:35'],
    ['leave', '1 9:45'],
    ['start', '1 10:00'],
  ]);
});

test('no prep or travel gives a single alert', () => {
  assert.deepEqual(alertsForOccurrence(base({}), day(1, 10)).map((a) => a.kind), ['start']);
});

test('weekly on Mon/Wed/Fri', () => {
  const r = base({ repeat: { kind: 'weekly', weekdays: [1, 3, 5] } });
  const occ = occurrencesBetween(r, day(1), day(14, 23, 59)).map((d) => d.getDate());
  assert.deepEqual(occ, [2, 4, 7, 9, 11, 14]);
});

test('every 8 hours for a 3-day antibiotic course stops at the end date', () => {
  const r = base({ category: 'medication', startAt: day(1, 8).toISOString(), repeat: { kind: 'interval', hours: 8 }, endAt: day(3).toISOString() });
  const occ = occurrencesBetween(r, day(1), day(20)).map(hm);
  assert.deepEqual(occ, ['1 8:00', '1 16:00', '2 0:00', '2 8:00', '2 16:00', '3 0:00', '3 8:00', '3 16:00']);
});

test('interval jumps to the window without walking from the start', () => {
  const r = base({ startAt: new Date(2020, 0, 1, 0, 0).toISOString(), repeat: { kind: 'interval', hours: 1 } });
  assert.equal(occurrencesBetween(r, day(1), day(1, 5, 30)).length, 6);
});

test('daily', () => {
  const r = base({ repeat: { kind: 'daily' } });
  assert.equal(occurrencesBetween(r, day(1), day(10, 23)).length, 10);
});

test('monthly on the 31st skips short months', () => {
  const r = base({ startAt: new Date(2027, 0, 31, 9).toISOString(), repeat: { kind: 'monthly' } });
  const months = occurrencesBetween(r, new Date(2027, 0, 1), new Date(2027, 5, 30)).map((d) => d.getMonth());
  assert.deepEqual(months, [0, 2, 4]); // Jan, Mar, May
});

test('disabled reminders are not planned and the plan is capped', () => {
  const now = day(1);
  assert.equal(planAlerts([base({ enabled: false, repeat: { kind: 'daily' } })], now).length, 0);
  const busy = base({ startAt: day(1, 1).toISOString(), repeat: { kind: 'interval', hours: 1 } });
  const plan = planAlerts([busy], now);
  assert.equal(plan.length, MAX_SCHEDULED);
  assert.ok(plan.every((a, i) => i === 0 || plan[i - 1].fireAt <= a.fireAt));
});

test('past alerts are not planned', () => {
  const r = base({ prepMinutes: 10, travelMinutes: 15 });
  const plan = planAlerts([r], day(1, 9, 40));
  assert.deepEqual(plan.map((a) => a.kind), ['leave', 'start']);
});

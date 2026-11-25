import type { Reminder } from './types';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Hard stop so a broken rule can never loop forever. */
const MAX_STEPS = 5000;

function endLimit(reminder: Reminder, to: Date): number {
  if (!reminder.endAt) return to.getTime();
  const end = new Date(reminder.endAt);
  end.setHours(23, 59, 59, 999);
  return Math.min(end.getTime(), to.getTime());
}

/** All occurrences of a reminder in [from, to], in chronological order. */
export function occurrencesBetween(reminder: Reminder, from: Date, to: Date): Date[] {
  const start = new Date(reminder.startAt);
  const limit = endLimit(reminder, to);
  const fromMs = from.getTime();
  const out: Date[] = [];
  const push = (d: Date) => {
    const t = d.getTime();
    if (t >= fromMs && t <= limit && t >= start.getTime()) out.push(d);
  };
  const r = reminder.repeat;

  switch (r.kind) {
    case 'none':
      push(start);
      break;

    case 'interval': {
      const step = Math.max(1, r.hours) * 60 * MINUTE;
      // Jump straight to the first step at or after `from`.
      let k = Math.max(0, Math.ceil((fromMs - start.getTime()) / step));
      for (let i = 0; i < MAX_STEPS; i++, k++) {
        const t = start.getTime() + k * step;
        if (t > limit) break;
        push(new Date(t));
      }
      break;
    }

    case 'daily':
    case 'weekly': {
      const days = r.kind === 'weekly' ? r.weekdays : [0, 1, 2, 3, 4, 5, 6];
      if (days.length === 0) break;
      const cursor = new Date(Math.max(start.getTime(), fromMs - DAY));
      cursor.setHours(start.getHours(), start.getMinutes(), 0, 0);
      for (let i = 0; i < MAX_STEPS && cursor.getTime() <= limit; i++) {
        if (days.includes(cursor.getDay())) push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      break;
    }

    case 'monthly': {
      const day = start.getDate();
      const cursor = new Date(start);
      for (let i = 0; i < MAX_STEPS; i++) {
        const d = new Date(cursor.getFullYear(), cursor.getMonth() + i, day, start.getHours(), start.getMinutes());
        if (d.getTime() > limit) break;
        // Skip months that don't have this day (e.g. 31st in April).
        if (d.getDate() === day) push(d);
      }
      break;
    }
  }
  return out;
}

export function nextOccurrence(reminder: Reminder, now = new Date()): Date | undefined {
  const horizon = new Date(now.getTime() + 400 * DAY);
  return occurrencesBetween(reminder, now, horizon)[0];
}

export type AlertKind = 'prepare' | 'leave' | 'start';

export interface PlannedAlert {
  reminderId: string;
  kind: AlertKind;
  /** When the notification fires. */
  fireAt: Date;
  /** When the activity itself starts. */
  eventAt: Date;
}

/**
 * The notifications for one occurrence. With prep/travel time set, the user is told
 * when to start getting ready and when to leave, then reminded at the start time.
 * Example: training 10:00, prep 10, travel 15 → 09:35 prepare, 09:45 leave, 10:00 start.
 */
export function alertsForOccurrence(reminder: Reminder, eventAt: Date): PlannedAlert[] {
  const prep = Math.max(0, reminder.prepMinutes ?? 0);
  const travel = Math.max(0, reminder.travelMinutes ?? 0);
  const alerts: PlannedAlert[] = [];
  const base = { reminderId: reminder.id, eventAt };
  if (prep > 0) {
    alerts.push({ ...base, kind: 'prepare', fireAt: new Date(eventAt.getTime() - (prep + travel) * MINUTE) });
  }
  if (travel > 0) {
    alerts.push({ ...base, kind: 'leave', fireAt: new Date(eventAt.getTime() - travel * MINUTE) });
  }
  alerts.push({ ...base, kind: 'start', fireAt: eventAt });
  return alerts;
}

/** iOS keeps at most 64 pending local notifications per app; stay under it. */
export const MAX_SCHEDULED = 60;

/** Every alert due in the next `days` days, soonest first, capped at MAX_SCHEDULED. */
export function planAlerts(reminders: Reminder[], now = new Date(), days = 14): PlannedAlert[] {
  // Look a little past the window so "prepare" alerts for early events are not lost.
  const to = new Date(now.getTime() + days * DAY);
  const all: PlannedAlert[] = [];
  for (const r of reminders) {
    if (!r.enabled) continue;
    for (const occ of occurrencesBetween(r, now, new Date(to.getTime() + DAY))) {
      for (const a of alertsForOccurrence(r, occ)) {
        if (a.fireAt > now && a.fireAt <= to) all.push(a);
      }
    }
  }
  all.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  return all.slice(0, MAX_SCHEDULED);
}

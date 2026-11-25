import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { TFunction } from '../i18n';
import { isRainy, KEYS, loadJSON, rainChanceFor, rainExtraMinutes, saveJSON, WeatherCache } from './engine';
import { formatTime } from './format';
import { occurrenceKey, planAlerts, PlannedAlert } from './schedule';
import type { Reminder } from './types';

const CHANNEL_ID = 'reminders';
const CATEGORY_ID = 'reminder';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';
export const SNOOZE_MINUTES = 10;
/** Snoozed copies survive a reschedule; everything else is rebuilt from the data. */
const SNOOZE_PREFIX = 'snooze|';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Asks for permission (once) and sets up the Android channel. Returns whether notifications are allowed. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** "Done" and "Snooze 10 min" buttons, in the current language. */
async function registerCategory(t: TFunction) {
  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    // Both open the app so the action is handled even if the app was closed.
    { identifier: ACTION_DONE, buttonTitle: t('actionDone'), options: { opensAppToForeground: true } },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: t('actionSnooze', { minutes: SNOOZE_MINUTES }),
      options: { opensAppToForeground: true },
    },
  ]);
}

export function buildContent(alert: PlannedAlert, reminder: Reminder, t: TFunction, weather: WeatherCache = {}) {
  const title = reminder.person ? `${reminder.title} (${t('forPerson', { person: reminder.person })})` : reminder.title;
  const time = formatTime(alert.eventAt);
  const travel = alert.travelMinutes;
  const rain = travel > 0 && isRainy(weather, reminder, alert.eventAt)
    ? ' ' + t('notifRain', { chance: rainChanceFor(weather, reminder, alert.eventAt) ?? 0 })
    : '';
  switch (alert.kind) {
    case 'prepare': {
      const leave = formatTime(new Date(alert.eventAt.getTime() - travel * 60_000));
      return {
        title: t('notifPrepareTitle'),
        body: (travel > 0 ? t('notifPrepareBody', { title, time, leave }) : t('notifPrepareBodyNoTravel', { title, time })) + rain,
      };
    }
    case 'leave':
      return {
        title: t('notifLeaveTitle'),
        body: t('notifLeaveBody', { title, time, minutes: travel, place: reminder.location || title }) + rain,
      };
    case 'start':
      return {
        title: t('notifStartTitle', { title }),
        body: [t('notifStartBody', { time }), reminder.location, reminder.notes].filter(Boolean).join(' · '),
      };
  }
}

export interface ScheduleExtras {
  done?: string[];
  weather?: WeatherCache;
}

let queue: Promise<void> = Promise.resolve();

/**
 * Replaces the scheduled notifications with a fresh plan for the next two weeks.
 * Called whenever data changes, whenever the app opens, and from the background task.
 */
export function rescheduleAll(reminders: Reminder[], t: TFunction, extras: ScheduleExtras = {}): Promise<void> {
  // Run one at a time: two overlapping runs could both cancel, then both schedule, doubling alerts.
  queue = queue.catch(() => {}).then(() => doReschedule(reminders, t, extras));
  return queue;
}

async function doReschedule(reminders: Reminder[], t: TFunction, { done = [], weather = {} }: ScheduleExtras) {
  if (Platform.OS === 'web') return;
  const granted = await ensureNotificationPermission();
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => !n.identifier.startsWith(SNOOZE_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
  if (!granted) return;
  await registerCategory(t);

  const byId = new Map(reminders.map((r) => [r.id, r]));
  const plan = planAlerts(reminders, new Date(), 14, {
    doneKeys: new Set(done),
    extraTravelMinutes: rainExtraMinutes(weather),
  });
  for (const alert of plan) {
    const reminder = byId.get(alert.reminderId);
    if (!reminder) continue;
    const key = occurrenceKey(reminder.id, alert.eventAt);
    await Notifications.scheduleNotificationAsync({
      identifier: `${key}|${alert.kind}`,
      content: {
        ...buildContent(alert, reminder, t, weather),
        sound: true,
        categoryIdentifier: CATEGORY_ID,
        data: { reminderId: reminder.id, occurrence: key },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: alert.fireAt, channelId: CHANNEL_ID },
    });
  }
}

/**
 * Handles the "Done" / "Snooze" buttons. Returns the updated done-list when an occurrence was
 * marked done (so the caller can reschedule), otherwise undefined.
 */
export async function handleNotificationResponse(response: Notifications.NotificationResponse): Promise<string[] | undefined> {
  const { notification, actionIdentifier } = response;
  const occurrence = notification.request.content.data?.occurrence;
  await Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});

  if (actionIdentifier === ACTION_SNOOZE) {
    const c = notification.request.content;
    await Notifications.scheduleNotificationAsync({
      identifier: `${SNOOZE_PREFIX}${notification.request.identifier}|${Date.now()}`,
      content: { title: c.title ?? '', body: c.body ?? '', sound: true, categoryIdentifier: CATEGORY_ID, data: c.data ?? {} },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + SNOOZE_MINUTES * 60_000),
        channelId: CHANNEL_ID,
      },
    });
    return undefined;
  }

  if (actionIdentifier === ACTION_DONE && typeof occurrence === 'string') {
    const done = await loadJSON<string[]>(KEYS.done, []);
    if (!done.includes(occurrence)) done.push(occurrence);
    await saveJSON(KEYS.done, done);
    // Drop any snoozed copies of this occurrence too.
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.occurrence === occurrence)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
    return done;
  }
  return undefined;
}

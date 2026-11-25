import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { TFunction } from '../i18n';
import { formatTime } from './format';
import { planAlerts, PlannedAlert } from './schedule';
import type { Reminder } from './types';

const CHANNEL_ID = 'reminders';

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

function buildContent(alert: PlannedAlert, reminder: Reminder, t: TFunction) {
  const title = reminder.person ? `${reminder.title} (${t('forPerson', { person: reminder.person })})` : reminder.title;
  const time = formatTime(alert.eventAt);
  const travel = reminder.travelMinutes ?? 0;
  switch (alert.kind) {
    case 'prepare': {
      const leave = formatTime(new Date(alert.eventAt.getTime() - travel * 60_000));
      return {
        title: t('notifPrepareTitle'),
        body: travel > 0 ? t('notifPrepareBody', { title, time, leave }) : t('notifPrepareBodyNoTravel', { title, time }),
      };
    }
    case 'leave':
      return {
        title: t('notifLeaveTitle'),
        body: t('notifLeaveBody', { title, time, minutes: travel, place: reminder.location || title }),
      };
    case 'start':
      return {
        title: t('notifStartTitle', { title }),
        body: [t('notifStartBody', { time }), reminder.location, reminder.notes].filter(Boolean).join(' · '),
      };
  }
}

/**
 * Replaces every scheduled notification with a fresh plan for the next two weeks.
 * Called whenever reminders change and whenever the app opens, so the window keeps rolling forward.
 */
let queue: Promise<void> = Promise.resolve();

export function rescheduleAll(reminders: Reminder[], t: TFunction): Promise<void> {
  // Run one at a time: two overlapping runs could both cancel, then both schedule, doubling alerts.
  queue = queue.catch(() => {}).then(() => doReschedule(reminders, t));
  return queue;
}

async function doReschedule(reminders: Reminder[], t: TFunction): Promise<void> {
  if (Platform.OS === 'web') return;
  const granted = await ensureNotificationPermission();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!granted) return;
  const byId = new Map(reminders.map((r) => [r.id, r]));
  for (const alert of planAlerts(reminders)) {
    const reminder = byId.get(alert.reminderId);
    if (!reminder) continue;
    await Notifications.scheduleNotificationAsync({
      content: { ...buildContent(alert, reminder, t), sound: true, data: { reminderId: reminder.id } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: alert.fireAt,
        channelId: CHANNEL_ID,
      },
    });
  }
}

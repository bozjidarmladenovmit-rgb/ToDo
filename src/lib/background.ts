/**
 * Runs about every 30 minutes while the app is closed (the phone decides the exact timing):
 * refreshes travel times and the forecast, then rebuilds the notification schedule.
 * This also keeps the two-week notification window rolling forward without opening the app.
 *
 * Note: background tasks do not run in Expo Go, only in a real build of the app.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { detectLanguage, makeT } from '../i18n';
import { translations } from '../i18n/translations';
import { KEYS, loadAll, pruneDone, refreshTravel, refreshWeather, saveJSON } from './engine';
import { rescheduleAll } from './notifications';
import type { LanguageCode } from './types';

export const BACKGROUND_TASK = 'daypilot-refresh';

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const data = await loadAll();
    // The language is stored as a plain string, not JSON, by the i18n provider.
    const saved = await AsyncStorage.getItem(KEYS.language);
    const lang = (saved && saved in translations ? saved : detectLanguage()) as LanguageCode;

    const reminders = (await refreshTravel(data.reminders, data.settings)) ?? data.reminders;
    if (reminders !== data.reminders) await saveJSON(KEYS.reminders, reminders);
    const weather = (await refreshWeather(reminders, data.weather)) ?? data.weather;
    if (weather !== data.weather) await saveJSON(KEYS.weather, weather);
    const done = pruneDone(data.done);

    await rescheduleAll(reminders, makeT(lang), { done, weather });
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (e) {
    console.warn('background refresh failed', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerBackgroundRefresh(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: 30 });
  } catch (e) {
    // Expected in Expo Go, where background tasks are not available.
    console.log('background refresh not available', e);
  }
}

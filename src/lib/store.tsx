import * as Notifications from 'expo-notifications';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useI18n } from '../i18n';
import {
  DEFAULT_SETTINGS,
  KEYS,
  loadAll,
  pruneDone,
  refreshTravel,
  refreshWeather,
  saveJSON,
  WeatherCache,
} from './engine';
import { handleNotificationResponse, rescheduleAll } from './notifications';
import type { Reminder, Settings, ShoppingItem } from './types';

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface StoreValue {
  loaded: boolean;
  reminders: Reminder[];
  shopping: ShoppingItem[];
  settings: Settings;
  weather: WeatherCache;
  saveReminder: (r: Reminder) => void;
  deleteReminder: (id: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  addShoppingItem: (name: string) => void;
  toggleShoppingItem: (id: string) => void;
  deleteShoppingItem: (id: string) => void;
  clearBought: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [done, setDone] = useState<string[]>([]);
  const [weather, setWeather] = useState<WeatherCache>({});

  useEffect(() => {
    loadAll().then((d) => {
      setReminders(d.reminders);
      setShopping(d.shopping);
      setSettings(d.settings);
      setDone(pruneDone(d.done));
      setWeather(d.weather);
      setLoaded(true);
    });
  }, []);

  useEffect(() => void (loaded && saveJSON(KEYS.reminders, reminders)), [loaded, reminders]);
  useEffect(() => void (loaded && saveJSON(KEYS.shopping, shopping)), [loaded, shopping]);
  useEffect(() => void (loaded && saveJSON(KEYS.settings, settings)), [loaded, settings]);
  useEffect(() => void (loaded && saveJSON(KEYS.done, done)), [loaded, done]);
  useEffect(() => void (loaded && saveJSON(KEYS.weather, weather)), [loaded, weather]);

  // Keep the phone's notification schedule in sync with the data, the forecast and the language.
  useEffect(() => {
    if (!loaded) return;
    rescheduleAll(reminders, t, { done, weather }).catch((e) => console.warn('reschedule failed', e));
  }, [loaded, reminders, done, weather, t]);

  // Travel times and forecasts go stale: refresh them on start and whenever the app comes back.
  const latest = useRef({ reminders, settings, weather });
  latest.current = { reminders, settings, weather };
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const { reminders: rs, settings: st, weather: w } = latest.current;
      const updated = await refreshTravel(rs, st);
      if (updated) {
        // Merge by id so edits made while we were waiting on the network are not lost.
        const byId = new Map(updated.map((r) => [r.id, r]));
        setReminders((cur) =>
          cur.map((r) => {
            const u = byId.get(r.id);
            return u && u.travelComputedAt !== r.travelComputedAt && r === rs.find((x) => x.id === r.id) ? u : r;
          }),
        );
      }
      const newWeather = await refreshWeather(updated ?? rs, w);
      if (newWeather) setWeather(newWeather);
    } finally {
      refreshing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setDone((d) => pruneDone(d));
        refresh();
      }
    });
    return () => sub.remove();
  }, [loaded, refresh]);

  // "Done" / "Snooze" buttons on notifications.
  useEffect(() => {
    if (!loaded) return;
    const handled = new Set<string>();
    const onResponse = async (response: Notifications.NotificationResponse) => {
      // On a cold start the same tap can arrive both as the "last response" and through the listener.
      const id = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
      if (handled.has(id)) return;
      handled.add(id);
      const newDone = await handleNotificationResponse(response);
      if (newDone) setDone(newDone);
    };
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      onResponse(last);
      Notifications.clearLastNotificationResponse();
    }
    const sub = Notifications.addNotificationResponseReceivedListener(onResponse);
    return () => sub.remove();
  }, [loaded]);

  const saveReminder = useCallback((r: Reminder) => {
    setReminders((list) => (list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]));
  }, []);
  const deleteReminder = useCallback((id: string) => setReminders((list) => list.filter((x) => x.id !== id)), []);
  const updateSettings = useCallback((s: Partial<Settings>) => {
    setSettings((cur) => ({ ...cur, ...s }));
    // A new home changes every automatic travel time.
    if ('home' in s) setReminders((list) => list.map((r) => (r.travelAuto ? { ...r, travelComputedAt: undefined } : r)));
  }, []);

  // New or changed reminders with automatic travel (and a new home) have no travel time yet: calculate it now.
  const needsTravel = reminders.some((r) => r.enabled && r.travelAuto && r.place && !r.travelComputedAt);
  useEffect(() => {
    if (loaded && needsTravel) refresh();
  }, [loaded, needsTravel, reminders, refresh]);

  const addShoppingItem = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setShopping((list) => [{ id: newId(), name: trimmed, bought: false, createdAt: new Date().toISOString() }, ...list]);
  }, []);
  const toggleShoppingItem = useCallback(
    (id: string) => setShopping((list) => list.map((x) => (x.id === id ? { ...x, bought: !x.bought } : x))),
    [],
  );
  const deleteShoppingItem = useCallback((id: string) => setShopping((list) => list.filter((x) => x.id !== id)), []);
  const clearBought = useCallback(() => setShopping((list) => list.filter((x) => !x.bought)), []);

  const value = useMemo(
    () => ({
      loaded,
      reminders,
      shopping,
      settings,
      weather,
      saveReminder,
      deleteReminder,
      updateSettings,
      addShoppingItem,
      toggleShoppingItem,
      deleteShoppingItem,
      clearBought,
    }),
    [loaded, reminders, shopping, settings, weather, saveReminder, deleteReminder, updateSettings, addShoppingItem, toggleShoppingItem, deleteShoppingItem, clearBought],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

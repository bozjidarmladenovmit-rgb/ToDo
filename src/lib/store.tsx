import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useI18n } from '../i18n';
import { rescheduleAll } from './notifications';
import type { Reminder, ShoppingItem } from './types';

const REMINDERS_KEY = 'data.reminders.v1';
const SHOPPING_KEY = 'data.shopping.v1';

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface StoreValue {
  loaded: boolean;
  reminders: Reminder[];
  shopping: ShoppingItem[];
  saveReminder: (r: Reminder) => void;
  deleteReminder: (id: string) => void;
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

  useEffect(() => {
    (async () => {
      const [r, s] = await Promise.all([AsyncStorage.getItem(REMINDERS_KEY), AsyncStorage.getItem(SHOPPING_KEY)]);
      if (r) setReminders(JSON.parse(r));
      if (s) setShopping(JSON.parse(s));
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
  }, [loaded, reminders]);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(SHOPPING_KEY, JSON.stringify(shopping));
  }, [loaded, shopping]);

  // Keep the phone's notification schedule in sync with the data and the language.
  const latest = useRef({ reminders, t });
  latest.current = { reminders, t };
  useEffect(() => {
    if (!loaded) return;
    rescheduleAll(reminders, t).catch((e) => console.warn('reschedule failed', e));
  }, [loaded, reminders, t]);

  // Roll the two-week window forward whenever the app comes back to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && loaded) {
        rescheduleAll(latest.current.reminders, latest.current.t).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [loaded]);

  const saveReminder = useCallback((r: Reminder) => {
    setReminders((list) => (list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r]));
  }, []);
  const deleteReminder = useCallback((id: string) => setReminders((list) => list.filter((x) => x.id !== id)), []);

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
      saveReminder,
      deleteReminder,
      addShoppingItem,
      toggleShoppingItem,
      deleteShoppingItem,
      clearBought,
    }),
    [loaded, reminders, shopping, saveReminder, deleteReminder, addShoppingItem, toggleShoppingItem, deleteShoppingItem, clearBought],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useStore must be used inside StoreProvider');
  return v;
}

import { Link, router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ReminderRow } from '../components/ReminderRow';
import { Button, colors, styles } from '../components/ui';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import { CATEGORIES } from '../lib/categories';
import { occurrencesBetween } from '../lib/schedule';
import { useStore } from '../lib/store';

const UPCOMING_DAYS = 7;
const UPCOMING_MAX = 15;

export default function Home() {
  const { t } = useI18n();
  const { reminders, shopping } = useStore();

  const upcoming = useMemo(() => {
    const now = new Date();
    const to = new Date(now.getTime() + UPCOMING_DAYS * 86_400_000);
    return reminders
      .filter((r) => r.enabled)
      .flatMap((r) => occurrencesBetween(r, now, to).map((at) => ({ r, at })))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, UPCOMING_MAX);
  }, [reminders]);

  const countFor = (id: string) =>
    id === 'shopping' ? shopping.filter((s) => !s.bought).length : reminders.filter((r) => r.category === id).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/settings" asChild>
              <Pressable hitSlop={12} accessibilityLabel={t('settings')}>
                <Text style={{ fontSize: 22 }}>⚙️</Text>
              </Pressable>
            </Link>
          ),
        }}
      />

      <Button title={`＋ ${t('newReminder')}`} onPress={() => router.push('/reminder/edit')} />

      <Text style={styles.h2}>{t('sections')}</Text>
      <View style={[styles.wrap, { justifyContent: 'space-between', columnGap: 0, rowGap: 10 }]}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: '/category/[id]', params: { id: c.id } })}
            style={({ pressed }) => [
              styles.card,
              { width: '48%', borderLeftWidth: 5, borderLeftColor: c.color, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ fontSize: 28 }}>{c.emoji}</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 4 }}>
              {t(`cat_${c.id}` as TranslationKey)}
            </Text>
            <Text style={styles.muted}>{countFor(c.id)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.h2}>{t('today')}</Text>
      {upcoming.length === 0 ? (
        <Text style={styles.muted}>{t('nothingToday')}</Text>
      ) : (
        upcoming.map(({ r, at }) => <ReminderRow key={`${r.id}-${at.getTime()}`} reminder={r} at={at} />)
      )}
    </ScrollView>
  );
}

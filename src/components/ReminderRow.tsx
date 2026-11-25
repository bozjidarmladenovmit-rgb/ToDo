import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import { getCategory } from '../lib/categories';
import { formatDateTime } from '../lib/format';
import type { Reminder } from '../lib/types';
import { colors, styles } from './ui';

export function ReminderRow({ reminder, at }: { reminder: Reminder; at?: Date }) {
  const { t } = useI18n();
  const cat = getCategory(reminder.category);
  const leaveMinutes = (reminder.prepMinutes ?? 0) + (reminder.travelMinutes ?? 0);
  const details = [
    reminder.person && t('forPerson', { person: reminder.person }),
    reminder.location && `📍 ${reminder.location}`,
    leaveMinutes > 0 && `⏱ ${leaveMinutes} ${t('min')}`,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/reminder/edit', params: { id: reminder.id } })}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : reminder.enabled ? 1 : 0.5 }]}
    >
      <View style={styles.row}>
        <Text style={{ fontSize: 26 }}>{cat.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{reminder.title}</Text>
          <Text style={styles.muted}>
            {at ? formatDateTime(at, t) : t(`cat_${cat.id}` as TranslationKey)}
            {details.length > 0 ? ` · ${details.join(' · ')}` : ''}
          </Text>
        </View>
        <View style={{ width: 6, alignSelf: 'stretch', borderRadius: 3, backgroundColor: cat.color }} />
      </View>
    </Pressable>
  );
}

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { ReminderRow } from '../../components/ReminderRow';
import { Button, colors, Input, styles } from '../../components/ui';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/translations';
import { getCategory } from '../../lib/categories';
import { nextOccurrence } from '../../lib/schedule';
import { useStore } from '../../lib/store';

function ShoppingList() {
  const { t } = useI18n();
  const { shopping, addShoppingItem, toggleShoppingItem, deleteShoppingItem, clearBought } = useStore();
  const [text, setText] = useState('');
  const submit = () => {
    addShoppingItem(text);
    setText('');
  };
  const sorted = [...shopping].sort((a, b) => Number(a.bought) - Number(b.bought));

  return (
    <>
      <View style={styles.row}>
        <Input
          style={{ flex: 1 }}
          value={text}
          onChangeText={setText}
          placeholder={t('shoppingPlaceholder')}
          onSubmitEditing={submit}
          returnKeyType="done"
          submitBehavior="submit"
        />
        <Button title={t('add')} onPress={submit} />
      </View>
      {sorted.length === 0 && <Text style={styles.muted}>{t('emptyShopping')}</Text>}
      {sorted.map((item) => (
        <View key={item.id} style={[styles.card, styles.row]}>
          <Pressable
            onPress={() => toggleShoppingItem(item.id)}
            style={[styles.row, { flex: 1 }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.bought }}
          >
            <Text style={{ fontSize: 22 }}>{item.bought ? '✅' : '⬜'}</Text>
            <Text
              style={{
                fontSize: 16,
                color: item.bought ? colors.muted : colors.text,
                textDecorationLine: item.bought ? 'line-through' : 'none',
              }}
            >
              {item.name}
            </Text>
          </Pressable>
          <Pressable onPress={() => deleteShoppingItem(item.id)} hitSlop={10} accessibilityLabel={t('delete')}>
            <Text style={{ fontSize: 18 }}>🗑️</Text>
          </Pressable>
        </View>
      ))}
      {shopping.some((s) => s.bought) && <Button title={t('clearBought')} variant="ghost" onPress={clearBought} />}
    </>
  );
}

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const { reminders } = useStore();
  const cat = getCategory(id);
  const title = `${cat.emoji} ${t(`cat_${cat.id}` as TranslationKey)}`;

  const items = reminders
    .filter((r) => r.category === cat.id)
    .map((r) => ({ r, next: nextOccurrence(r) }))
    // Upcoming first (soonest on top), finished ones at the bottom.
    .sort((a, b) => (a.next?.getTime() ?? Infinity) - (b.next?.getTime() ?? Infinity));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      {cat.id === 'shopping' && <ShoppingList />}
      {cat.id === 'shopping' && items.length > 0 && <Text style={styles.h2}>{t('today')}</Text>}

      <Button
        title={`＋ ${t('newReminder')}`}
        variant={cat.id === 'shopping' ? 'ghost' : 'primary'}
        onPress={() => router.push({ pathname: '/reminder/edit', params: { category: cat.id } })}
      />
      {cat.id !== 'shopping' && items.length === 0 && <Text style={styles.muted}>{t('noReminders')}</Text>}
      {items.map(({ r, next }) => (
        <ReminderRow key={r.id} reminder={r} at={next} />
      ))}
    </ScrollView>
  );
}

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, Switch, Text, View } from 'react-native';

import { Button, Chip, DateTimeField, Input, Label, styles } from '../../components/ui';
import { useI18n } from '../../i18n';
import type { TranslationKey } from '../../i18n/translations';
import { CATEGORIES, getCategory } from '../../lib/categories';
import { newId, useStore } from '../../lib/store';
import type { CategoryId, Reminder, Repeat } from '../../lib/types';

type RepeatKind = Repeat['kind'];
const REPEAT_KINDS: { kind: RepeatKind; key: TranslationKey }[] = [
  { kind: 'none', key: 'repeatNone' },
  { kind: 'daily', key: 'repeatDaily' },
  { kind: 'weekly', key: 'repeatWeekly' },
  { kind: 'interval', key: 'repeatInterval' },
  { kind: 'monthly', key: 'repeatMonthly' },
];
// Monday first, as is usual in Europe.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function defaultStart(): Date {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  return d;
}

const toInt = (s: string) => {
  const n = parseInt(s.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

export default function EditReminder() {
  const params = useLocalSearchParams<{ id?: string; category?: string }>();
  const { t } = useI18n();
  const { reminders, saveReminder, deleteReminder } = useStore();
  const existing = reminders.find((r) => r.id === params.id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [category, setCategory] = useState<CategoryId>(
    existing?.category ?? (params.category ? getCategory(params.category).id : 'general'),
  );
  const [start, setStart] = useState(existing ? new Date(existing.startAt) : defaultStart());
  const [repeatKind, setRepeatKind] = useState<RepeatKind>(existing?.repeat.kind ?? 'none');
  const [weekdays, setWeekdays] = useState<number[]>(
    existing?.repeat.kind === 'weekly' ? existing.repeat.weekdays : [start.getDay()],
  );
  const [hours, setHours] = useState(String(existing?.repeat.kind === 'interval' ? existing.repeat.hours : 8));
  const [endAt, setEndAt] = useState<Date | undefined>(existing?.endAt ? new Date(existing.endAt) : undefined);
  const [person, setPerson] = useState(existing?.person ?? '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [prep, setPrep] = useState(existing?.prepMinutes ? String(existing.prepMinutes) : '');
  const [travel, setTravel] = useState(existing?.travelMinutes ? String(existing.travelMinutes) : '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);

  const cat = getCategory(category);

  const setDatePart = (d: Date) => {
    const n = new Date(start);
    n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    setStart(n);
  };
  const setTimePart = (d: Date) => {
    const n = new Date(start);
    n.setHours(d.getHours(), d.getMinutes(), 0, 0);
    setStart(n);
  };

  const buildRepeat = (): Repeat => {
    switch (repeatKind) {
      case 'weekly':
        return { kind: 'weekly', weekdays: weekdays.length ? weekdays : [start.getDay()] };
      case 'interval':
        return { kind: 'interval', hours: Math.min(168, Math.max(1, toInt(hours) ?? 8)) };
      default:
        return { kind: repeatKind } as Repeat;
    }
  };

  const save = () => {
    if (!title.trim()) {
      Alert.alert(t('titleRequired'));
      return;
    }
    const r: Reminder = {
      id: existing?.id ?? newId(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      title: title.trim(),
      category,
      startAt: start.toISOString(),
      repeat: buildRepeat(),
      endAt: repeatKind !== 'none' && endAt ? endAt.toISOString() : undefined,
      person: person.trim() || undefined,
      location: cat.usesLocation ? location.trim() || undefined : undefined,
      prepMinutes: toInt(prep) || undefined,
      travelMinutes: cat.usesLocation ? toInt(travel) || undefined : undefined,
      notes: notes.trim() || undefined,
      enabled,
    };
    saveReminder(r);
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    const doDelete = () => {
      deleteReminder(existing.id);
      router.back();
    };
    if (Platform.OS === 'web') return doDelete();
    Alert.alert(t('confirmDelete'), existing.title, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: existing ? t('editReminder') : t('newReminder') }} />

      <Label>{t('title')}</Label>
      <Input value={title} onChangeText={setTitle} placeholder={t('titlePlaceholder')} autoFocus={!existing} />

      <Label>{t('section')}</Label>
      <View style={styles.wrap}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            label={`${c.emoji} ${t(`cat_${c.id}` as TranslationKey)}`}
            selected={category === c.id}
            color={c.color}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>

      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <View style={{ flex: 3 }}>
          <Label>{t('date')}</Label>
          <DateTimeField value={start} mode="date" onChange={setDatePart} />
        </View>
        <View style={{ flex: 2 }}>
          <Label>{t('time')}</Label>
          <DateTimeField value={start} mode="time" onChange={setTimePart} />
        </View>
      </View>

      <Label>{t('repeat')}</Label>
      <View style={styles.wrap}>
        {REPEAT_KINDS.map((r) => (
          <Chip key={r.kind} label={t(r.key)} selected={repeatKind === r.kind} onPress={() => setRepeatKind(r.kind)} />
        ))}
      </View>

      {repeatKind === 'weekly' && (
        <>
          <Label>{t('weekdays')}</Label>
          <View style={styles.wrap}>
            {WEEK_ORDER.map((d) => (
              <Chip
                key={d}
                label={t(`wd${d}` as TranslationKey)}
                selected={weekdays.includes(d)}
                onPress={() => setWeekdays((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
              />
            ))}
          </View>
        </>
      )}

      {repeatKind === 'interval' && (
        <>
          <Label>{t('everyHours')}</Label>
          <Input value={hours} onChangeText={setHours} keyboardType="number-pad" />
        </>
      )}

      {repeatKind !== 'none' && (
        <>
          <Label>{t('endDate')}</Label>
          {endAt ? (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <DateTimeField value={endAt} mode="date" onChange={setEndAt} />
              </View>
              <Button title="✕" variant="ghost" onPress={() => setEndAt(undefined)} />
            </View>
          ) : (
            <Button
              title={t('setEndDate')}
              variant="ghost"
              onPress={() => setEndAt(new Date(start.getTime() + 7 * 86_400_000))}
            />
          )}
        </>
      )}

      <Label>{t('person')}</Label>
      <Input value={person} onChangeText={setPerson} placeholder={t('personPlaceholder')} />

      {cat.usesLocation && (
        <>
          <Label>{t('location')}</Label>
          <Input value={location} onChangeText={setLocation} placeholder={t('locationPlaceholder')} />
        </>
      )}

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Label>{t('prepMinutes')}</Label>
          <Input value={prep} onChangeText={setPrep} keyboardType="number-pad" placeholder="0" />
        </View>
        {cat.usesLocation && (
          <View style={{ flex: 1 }}>
            <Label>{t('travelMinutes')}</Label>
            <Input value={travel} onChangeText={setTravel} keyboardType="number-pad" placeholder="0" />
          </View>
        )}
      </View>
      {cat.usesLocation && <Text style={styles.muted}>{t('travelHint')}</Text>}

      <Label>{t('notes')}</Label>
      <Input value={notes} onChangeText={setNotes} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />

      <View style={[styles.row, { justifyContent: 'space-between', marginTop: 8 }]}>
        <Text style={{ fontSize: 16 }}>{t('enabled')}</Text>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>

      <View style={{ gap: 8, marginTop: 12 }}>
        <Button title={t('save')} onPress={save} />
        {existing && <Button title={t('delete')} variant="danger" onPress={remove} />}
      </View>
    </ScrollView>
  );
}

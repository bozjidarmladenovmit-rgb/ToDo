import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ReactNode, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { useI18n } from '../i18n';
import { LOCALE_TAGS } from '../i18n/translations';
import { formatDate, formatTime } from '../lib/format';

export const colors = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  primary: '#4F46E5',
  danger: '#DC2626',
};

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.input, props.style]} />;
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.primary,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && { backgroundColor: color, borderColor: color }]}
    >
      <Text style={[styles.chipText, selected && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'danger' | 'ghost';
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'ghost' ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

/** A field that opens the native date or time picker (dialog on Android, sheet on iOS). */
export function DateTimeField({
  value,
  mode,
  onChange,
}: {
  value: Date;
  mode: 'date' | 'time';
  onChange: (d: Date) => void;
}) {
  const { t, lang } = useI18n();
  const [iosOpen, setIosOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value,
        mode,
        is24Hour: true,
        onValueChange: (_e, d) => onChange(d),
      });
    } else {
      setDraft(value);
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable onPress={open} style={styles.input} accessibilityRole="button">
        <Text style={{ color: colors.text, fontSize: 16 }}>{mode === 'date' ? formatDate(value, t) + value.getFullYear() : formatTime(value)}</Text>
      </Pressable>
      {Platform.OS === 'ios' && (
        <Modal visible={iosOpen} transparent animationType="slide" onRequestClose={() => setIosOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <DateTimePicker
                value={draft}
                mode={mode}
                display={mode === 'date' ? 'inline' : 'spinner'}
                locale={LOCALE_TAGS[lang]}
                onValueChange={(_e, d) => setDraft(d)}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                <Button title={t('cancel')} variant="ghost" onPress={() => setIosOpen(false)} />
                <Button
                  title={t('save')}
                  onPress={() => {
                    onChange(draft);
                    setIosOpen(false);
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12, paddingBottom: 48 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  h2: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { color: colors.text, fontSize: 14 },
  button: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: colors.card, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 12 },
});

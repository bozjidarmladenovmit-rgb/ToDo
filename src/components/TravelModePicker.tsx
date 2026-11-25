import { View } from 'react-native';

import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/translations';
import type { TravelMode } from '../lib/types';
import { Chip, styles } from './ui';

const MODES: { mode: TravelMode; emoji: string; key: TranslationKey }[] = [
  { mode: 'drive', emoji: '🚗', key: 'modeDrive' },
  { mode: 'walk', emoji: '🚶', key: 'modeWalk' },
  { mode: 'bike', emoji: '🚲', key: 'modeBike' },
  { mode: 'transit', emoji: '🚌', key: 'modeTransit' },
];

export function TravelModePicker({ value, onChange }: { value: TravelMode; onChange: (m: TravelMode) => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      {MODES.map((m) => (
        <Chip key={m.mode} label={`${m.emoji} ${t(m.key)}`} selected={value === m.mode} onPress={() => onChange(m.mode)} />
      ))}
    </View>
  );
}

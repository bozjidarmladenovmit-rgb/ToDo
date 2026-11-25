import { ScrollView } from 'react-native';

import { Chip, Label, styles } from '../components/ui';
import { useI18n } from '../i18n';
import { LANGUAGES } from '../i18n/translations';

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Label>{t('language')}</Label>
      {LANGUAGES.map((l) => (
        <Chip key={l.code} label={l.name} selected={lang === l.code} onPress={() => setLang(l.code)} />
      ))}
    </ScrollView>
  );
}

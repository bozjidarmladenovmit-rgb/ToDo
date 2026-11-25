import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { PlacePicker } from '../components/PlacePicker';
import { TravelModePicker } from '../components/TravelModePicker';
import { Button, Chip, Label, styles } from '../components/ui';
import { useI18n } from '../i18n';
import { LANGUAGES } from '../i18n/translations';
import { useStore } from '../lib/store';
import { hasGoogleKey } from '../lib/travel';
import type { Place } from '../lib/types';

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { settings, updateSettings } = useStore();
  const [homeText, setHomeText] = useState(settings.home?.label ?? '');
  const [homePlace, setHomePlace] = useState<Place | undefined>(settings.home);
  const homeChanged = homePlace?.lat !== settings.home?.lat || homePlace?.lng !== settings.home?.lng;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Label>{t('home')}</Label>
      <Text style={styles.muted}>{t('homeHint')}</Text>
      <PlacePicker
        text={homeText}
        onTextChange={setHomeText}
        place={homePlace}
        onPlaceChange={setHomePlace}
        placeholder={t('homePlaceholder')}
      />
      {homeChanged && homePlace && <Button title={t('save')} onPress={() => updateSettings({ home: homePlace })} />}

      <Label>{t('defaultTravelMode')}</Label>
      <TravelModePicker value={settings.defaultTravelMode} onChange={(m) => updateSettings({ defaultTravelMode: m })} />
      <Text style={styles.muted}>{hasGoogleKey ? t('mapsLive') : t('mapsEstimate')}</Text>

      <Label>{t('language')}</Label>
      <View style={styles.wrap}>
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={l.name} selected={lang === l.code} onPress={() => setLang(l.code)} />
        ))}
      </View>
    </ScrollView>
  );
}

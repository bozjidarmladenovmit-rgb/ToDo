import * as Location from 'expo-location';
import { useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';

import { useI18n } from '../i18n';
import type { Place } from '../lib/types';
import { Button, colors, Input, styles } from './ui';

/**
 * Text field for an address plus "Find on map" and "Use my location" buttons.
 * The typed text is kept as-is; coordinates are attached once the address is found.
 */
export function PlacePicker({
  text,
  onTextChange,
  place,
  onPlaceChange,
  placeholder,
}: {
  text: string;
  onTextChange: (s: string) => void;
  place?: Place;
  onPlaceChange: (p: Place | undefined) => void;
  placeholder?: string;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = Platform.OS !== 'web';

  const find = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      // The phone's geocoder needs location permission on some devices.
      await Location.requestForegroundPermissionsAsync();
      const results = await Location.geocodeAsync(text.trim());
      if (results.length === 0) {
        setError(t('locationNotFound'));
        onPlaceChange(undefined);
      } else {
        onPlaceChange({ label: text.trim(), lat: results[0].latitude, lng: results[0].longitude });
      }
    } catch {
      setError(t('locationNotFound'));
    } finally {
      setBusy(false);
    }
  };

  const useCurrent = async () => {
    setBusy(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setError(t('locationPermissionDenied'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let label = text.trim();
      if (!label) {
        const [addr] = await Location.reverseGeocodeAsync(pos.coords).catch(() => []);
        label = addr ? [addr.street, addr.streetNumber, addr.city].filter(Boolean).join(' ') : t('myLocation');
        onTextChange(label);
      }
      onPlaceChange({ label, lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError(t('locationNotFound'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 6 }}>
      <Input
        value={text}
        onChangeText={(s) => {
          onTextChange(s);
          // The coordinates belonged to the old text.
          if (place && s.trim() !== place.label) onPlaceChange(undefined);
        }}
        placeholder={placeholder}
        onSubmitEditing={find}
        returnKeyType="search"
      />
      {supported && (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button title={`🔎 ${t('findOnMap')}`} variant="ghost" onPress={find} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title={`📍 ${t('useCurrentLocation')}`} variant="ghost" onPress={useCurrent} />
          </View>
        </View>
      )}
      {busy && <ActivityIndicator color={colors.primary} />}
      {!busy && place && <Text style={{ color: '#16A34A' }}>✓ {t('locationFound')}</Text>}
      {!busy && error && <Text style={{ color: colors.danger }}>{error}</Text>}
    </View>
  );
}

import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '../components/ui';
import { I18nProvider, useI18n } from '../i18n';
// Importing this module defines the background task; it must happen at startup.
import { registerBackgroundRefresh } from '../lib/background';
import { StoreProvider } from '../lib/store';

function AppStack() {
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('appName') }} />
      <Stack.Screen name="category/[id]" options={{ title: '' }} />
      <Stack.Screen name="reminder/edit" options={{ title: t('newReminder'), presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: t('settings') }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    registerBackgroundRefresh();
  }, []);
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <StoreProvider>
          <StatusBar style="dark" />
          <AppStack />
        </StoreProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

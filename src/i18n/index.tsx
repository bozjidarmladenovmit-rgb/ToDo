import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { LanguageCode } from '../lib/types';
import { translations, TranslationKey } from './translations';

const STORAGE_KEY = 'settings.language';

export function detectLanguage(): LanguageCode {
  for (const loc of getLocales()) {
    const code = loc.languageCode as LanguageCode | null;
    if (code && code in translations) return code;
  }
  return 'en';
}

export type TFunction = (key: TranslationKey, vars?: Record<string, string | number>) => string;

export function makeT(lang: LanguageCode): TFunction {
  const dict = translations[lang];
  return (key, vars) => {
    let s = dict[key] ?? translations.en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

interface I18nValue {
  lang: LanguageCode;
  setLang: (l: LanguageCode) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LanguageCode>(detectLanguage);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in translations) setLangState(saved as LanguageCode);
    });
  }, []);

  const setLang = useCallback((l: LanguageCode) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo(() => ({ lang, setLang, t: makeT(lang) }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used inside I18nProvider');
  return v;
}

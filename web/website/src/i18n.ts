import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en/translation.json';
import translationJA from './locales/ja/translation.json';
import translationVI from './locales/vi/translation.json';

const resources = {
  en: {
    translation: translationEN,
  },
  ja: {
    translation: translationJA,
  },
  vi: {
    translation: translationVI,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'cookie', 'htmlTag', 'path', 'subdomain'],
      caches: ['localStorage'],
    },
  });

const syncDocumentLanguage = (language: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language.split('-')[0];
  }
};

syncDocumentLanguage(i18n.resolvedLanguage || i18n.language || 'en');
i18n.on('languageChanged', syncDocumentLanguage);

export default i18n;

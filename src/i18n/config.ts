import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import es from '@/locales/es.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      es: {
        translation: es
      }
    },
    lng: 'en', // Default language (Golden Rule #1: Main pages in English)
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

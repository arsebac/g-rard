import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import fr from "./locales/fr.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    defaultNS: "translation",
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
    detection: {
      // Detect from: localStorage key "gerard_lang", then browser language
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "gerard_lang",
      caches: ["localStorage"],
    },
  });

export default i18n;

/** Helper to switch language and persist the choice */
export function setLanguage(lang: "en" | "fr") {
  i18n.changeLanguage(lang);
}

export type SupportedLocale = "en" | "fr";
export const SUPPORTED_LOCALES: { code: SupportedLocale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

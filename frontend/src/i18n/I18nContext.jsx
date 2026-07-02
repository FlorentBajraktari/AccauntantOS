import React, { createContext, useContext, useState, useCallback } from "react";
import { translations, LANGUAGES } from "@/i18n/translations";

const I18nContext = createContext(null);
const STORAGE_KEY = "aos_lang";

function resolve(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(STORAGE_KEY) || "en");

  const changeLang = useCallback((code) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLang(code);
    document.documentElement.lang = code;
  }, []);

  const t = useCallback(
    (key) => {
      const val = resolve(translations[lang], key);
      if (val != null) return val;
      const fallback = resolve(translations.en, key);
      return fallback != null ? fallback : key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, changeLang, t, languages: LANGUAGES }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);

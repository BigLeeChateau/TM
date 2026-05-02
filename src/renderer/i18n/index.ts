import { useCallback, useSyncExternalStore } from 'react'

export type Language = 'en' | 'fr' | 'ru' | 'ja' | 'es' | 'zh' | 'de'

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ru: 'Русский',
  ja: '日本語',
  es: 'Español',
  zh: '简体中文',
  de: 'Deutsch',
}

export const DEFAULT_LANGUAGE: Language = 'en'
const STORAGE_KEY = 'tm-language'

let currentLanguage: Language = DEFAULT_LANGUAGE

function loadLanguage(): Language {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && (raw in LANGUAGE_LABELS)) {
      return raw as Language
    }
  } catch { /* ignore */ }
  return DEFAULT_LANGUAGE
}

currentLanguage = loadLanguage()

const listeners = new Set<() => void>()

export function getLanguage(): Language {
  return currentLanguage
}

export function setLanguage(lang: Language): void {
  if (lang === currentLanguage) return
  currentLanguage = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch { /* ignore */ }
  for (const fn of listeners) fn()
}

// --- Translations ---
import { en } from './locales/en'
import { fr } from './locales/fr'
import { ru } from './locales/ru'
import { ja } from './locales/ja'
import { es } from './locales/es'
import { zh } from './locales/zh'
import { de } from './locales/de'

const translations: Record<Language, typeof en> = { en, fr, ru, ja, es, zh, de }

export type TranslationKey = keyof typeof en

export function t(key: TranslationKey): string {
  const tr = translations[currentLanguage]
  return tr[key] ?? en[key] ?? key
}

// --- React hook ---
export function useTranslation() {
  const lang = useSyncExternalStore(
    (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    getLanguage,
    getLanguage
  )

  const translate = useCallback((key: TranslationKey) => t(key), [lang])

  return { t: translate, language: lang, setLanguage }
}

export const LOCALES = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'it',
  'ru',
  'vi',
  'th',
  'id',
  'pl',
  'tr',
  'ar',
  'uk'
] as const

export type Locale = (typeof LOCALES)[number]

export const APP_LOCALES = ['zh-Hans', 'en', 'ja'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

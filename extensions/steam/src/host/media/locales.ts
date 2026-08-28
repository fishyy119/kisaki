import type { ContentLocale } from '@kisaki3/extension-sdk'

/** Steam store language names per content locale. */
const STEAM_LANGUAGES: Record<ContentLocale, string> = {
  en: 'english',
  'zh-Hans': 'schinese',
  'zh-Hant': 'tchinese',
  ja: 'japanese',
  ko: 'koreana',
  de: 'german',
  fr: 'french',
  es: 'spanish',
  pt: 'brazilian',
  it: 'italian',
  ru: 'russian',
  vi: 'vietnamese',
  th: 'thai',
  id: 'indonesian',
  pl: 'polish',
  tr: 'turkish',
  ar: 'arabic',
  uk: 'ukrainian'
}

export function toSteamLanguage(locale: ContentLocale): string {
  return STEAM_LANGUAGES[locale]
}

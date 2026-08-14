import type { UiLocale } from '@kisaki3/extension-api'
import { en } from './messages/en'
import { ja } from './messages/ja'
import { zhHans } from './messages/zh-hans'
import { zhHant } from './messages/zh-hant'

/** Full message catalog shape; the English catalog is the schema source. */
export type TmdbMessages = typeof en

const CATALOGS: Record<UiLocale, TmdbMessages> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

export function getTmdbMessages(locale: UiLocale): TmdbMessages {
  return CATALOGS[locale] ?? en
}

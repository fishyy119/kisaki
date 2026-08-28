import type { UiLocale } from '@kisaki3/extension-sdk'
import { en } from './messages/en'
import { ja } from './messages/ja'
import { zhHans } from './messages/zh-hans'
import { zhHant } from './messages/zh-hant'

/** The English catalog is the schema every locale must satisfy. */
export type NeodbMessages = typeof en

const catalogs: Record<UiLocale, NeodbMessages> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

export function getNeodbMessages(locale: UiLocale): NeodbMessages {
  return catalogs[locale] ?? en
}

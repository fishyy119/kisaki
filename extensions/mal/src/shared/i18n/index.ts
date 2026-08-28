import type { UiLocale } from '@kisaki3/extension-sdk'
import { en } from './messages/en'
import { ja } from './messages/ja'
import { zhHans } from './messages/zh-hans'
import { zhHant } from './messages/zh-hant'

/** The English catalog is the schema every locale must satisfy. */
export type MalMessages = typeof en

const catalogs: Record<UiLocale, MalMessages> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

export function getMalMessages(locale: UiLocale): MalMessages {
  return catalogs[locale] ?? en
}

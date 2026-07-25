import type { UiLocale } from '../locales'
import type { Messages } from './schema'
import { en } from './en'
import { ja } from './ja'
import { zhHans } from './zh-hans'
import { zhHant } from './zh-hant'

export type { Messages } from './schema'

/** All catalogs are statically bundled; text volume stays small by design. */
export const MESSAGE_CATALOGS: Record<UiLocale, Messages> = {
  en,
  ja,
  'zh-Hans': zhHans,
  'zh-Hant': zhHant
}

export function getMessages(locale: UiLocale): Messages {
  return MESSAGE_CATALOGS[locale]
}

import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { BangumiInfoboxItem } from '../../api/types'
import { omitUndefined } from '../../utils/object'
import { extractChineseNameFromInfobox } from './infobox'

export function isChineseLocale(locale?: ContentLocale): boolean {
  return locale === 'zh-Hans' || locale === 'zh-Hant'
}

export function resolveLocalizedSubjectName(
  name: string,
  nameCn: string | undefined,
  locale?: ContentLocale
): { name: string; originalName?: string } {
  const original = name.trim()
  const cn = nameCn?.trim() || ''

  if (isChineseLocale(locale) && cn) {
    return omitUndefined({
      name: cn,
      originalName: cn !== original ? original : undefined
    })
  }

  return { name: original || cn }
}

export function resolveLocalizedEntityName(
  name: string,
  infobox: BangumiInfoboxItem[] | null | undefined,
  locale?: ContentLocale
): { name: string; originalName?: string } {
  const original = name.trim()
  const cn = extractChineseNameFromInfobox(infobox)?.trim()

  if (isChineseLocale(locale) && cn) {
    return {
      name: cn,
      originalName: original
    }
  }

  return { name: original, originalName: original }
}

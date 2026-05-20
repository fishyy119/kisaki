import { BangumiExtensionError } from '../shared/errors'

export const BANGUMI_MEDIA_SCOPES = ['book', 'game', 'anime', 'music'] as const

export type BangumiMediaScope = (typeof BANGUMI_MEDIA_SCOPES)[number]
export type BangumiSupportedSubjectType = 1 | 2 | 3 | 4

export const BANGUMI_SUBJECT_TYPE_BY_SCOPE = {
  book: 1,
  game: 4,
  anime: 2,
  music: 3
} as const satisfies Record<BangumiMediaScope, BangumiSupportedSubjectType>

export function isBangumiMediaScope(value: unknown): value is BangumiMediaScope {
  return (
    typeof value === 'string' &&
    BANGUMI_MEDIA_SCOPES.includes(value as BangumiMediaScope)
  )
}

export function normalizeBangumiMediaScope(
  value: unknown,
  fallback: BangumiMediaScope = 'game'
): BangumiMediaScope {
  return isBangumiMediaScope(value) ? value : fallback
}

export function requireBangumiMediaScope(value: unknown): BangumiMediaScope {
  if (isBangumiMediaScope(value)) {
    return value
  }

  throw new BangumiExtensionError('bangumi_validation', '请选择有效的 Bangumi 媒体类型。')
}

export function getBangumiSubjectType(scope: BangumiMediaScope): BangumiSupportedSubjectType {
  return BANGUMI_SUBJECT_TYPE_BY_SCOPE[scope]
}

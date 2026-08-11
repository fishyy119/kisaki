/**
 * Bangumi media scopes.
 *
 * A scope is one Bangumi subject type the extension can work with. Both the
 * host and the settings webview select and label work by scope, so the
 * taxonomy lives here.
 */

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
  return typeof value === 'string' && BANGUMI_MEDIA_SCOPES.includes(value as BangumiMediaScope)
}

export function normalizeBangumiMediaScope(
  value: unknown,
  fallback: BangumiMediaScope = 'game'
): BangumiMediaScope {
  return isBangumiMediaScope(value) ? value : fallback
}

export function getBangumiSubjectType(scope: BangumiMediaScope): BangumiSupportedSubjectType {
  return BANGUMI_SUBJECT_TYPE_BY_SCOPE[scope]
}

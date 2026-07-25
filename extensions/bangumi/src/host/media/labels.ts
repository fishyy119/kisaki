import type { BangumiCollectionType } from '../api/types'
import { m } from '../i18n'
import type { BangumiMediaScope } from './scopes'

/** Localized display name for a media scope in the current host UI locale. */
export function getMediaScopeLabel(scope: BangumiMediaScope): string {
  return m().media.scopes[scope]
}

/** Localized label for a Bangumi collection type within a media scope. */
export function formatScopedCollectionType(
  scope: BangumiMediaScope,
  type: BangumiCollectionType
): string {
  return m().media.collections[scope][type]
}

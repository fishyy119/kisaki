import type { BangumiCollectionType } from '../api/types'
import type { BangumiMediaScope } from './scopes'

export const BANGUMI_SCOPE_LABELS = {
  book: '书籍',
  game: '游戏',
  anime: '动漫',
  music: '音乐'
} as const satisfies Record<BangumiMediaScope, string>

export const BANGUMI_COLLECTION_LABELS_BY_SCOPE = {
  book: {
    1: '想读',
    2: '读过',
    3: '在读',
    4: '搁置',
    5: '抛弃'
  },
  game: {
    1: '想玩',
    2: '玩过',
    3: '在玩',
    4: '搁置',
    5: '抛弃'
  },
  anime: {
    1: '想看',
    2: '看过',
    3: '在看',
    4: '搁置',
    5: '抛弃'
  },
  music: {
    1: '想听',
    2: '听过',
    3: '在听',
    4: '搁置',
    5: '抛弃'
  }
} as const satisfies Record<BangumiMediaScope, Record<BangumiCollectionType, string>>

export function getMediaScopeLabel(scope: BangumiMediaScope): string {
  return BANGUMI_SCOPE_LABELS[scope]
}

export function formatScopedCollectionType(
  scope: BangumiMediaScope,
  type: BangumiCollectionType
): string {
  return BANGUMI_COLLECTION_LABELS_BY_SCOPE[scope][type]
}

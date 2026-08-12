import type { LibraryEntityReference } from './entities'
import type { LibraryMediaType } from './graph'
import type { LibraryMediaRelationType } from '../../shared/library'

export type LibraryMediaTypePair = `${LibraryMediaType}-${LibraryMediaType}`

const SAME_TYPE_RELATION_TYPES: readonly LibraryMediaRelationType[] = [
  'sequel',
  'prequel',
  'sideStory',
  'parentStory',
  'summary',
  'fullStory',
  'alternative',
  'other'
]

const CROSS_TYPE_RELATION_TYPES: readonly LibraryMediaRelationType[] = [
  'adaptation',
  'sourceMaterial',
  'other'
]

/**
 * Allowed relation types per ordered endpoint pair. Same-type pairs carry the
 * structural vocabulary; cross-type pairs carry provenance only.
 */
export const LIBRARY_MEDIA_RELATION_TYPE_RULES: Record<
  LibraryMediaTypePair,
  readonly LibraryMediaRelationType[]
> = {
  'game-game': SAME_TYPE_RELATION_TYPES,
  'anime-anime': SAME_TYPE_RELATION_TYPES,
  'game-anime': CROSS_TYPE_RELATION_TYPES,
  'anime-game': CROSS_TYPE_RELATION_TYPES
}

/**
 * One directed entry-to-entry relation between media entries.
 *
 * Rows are stored exactly as written; readers merge both directions through
 * the inverse vocabulary, so an extension only manages the edges it writes.
 */
export interface LibraryMediaRelation {
  from: LibraryEntityReference<LibraryMediaType>
  to: LibraryEntityReference<LibraryMediaType>
  type: LibraryMediaRelationType
  note?: string
  order?: number
  createdAt?: number
  updatedAt?: number
}

export interface LibraryMediaRelationCreateInput {
  from: LibraryEntityReference<LibraryMediaType>
  to: LibraryEntityReference<LibraryMediaType>
  type: LibraryMediaRelationType
  note?: string
  order?: number
}

export interface LibraryMediaRelationSelector {
  from: LibraryEntityReference<LibraryMediaType>
  to: LibraryEntityReference<LibraryMediaType>
  type: LibraryMediaRelationType
}

export interface LibraryMediaRelationPatch {
  type?: LibraryMediaRelationType
  note?: string
  order?: number
}

export interface LibraryMediaRelationQuery {
  entity?: LibraryEntityReference<LibraryMediaType>
  relatedEntity?: LibraryEntityReference<LibraryMediaType>
}

export interface LibraryMediaRelationCapability {
  list(query?: LibraryMediaRelationQuery): Promise<readonly LibraryMediaRelation[]>
  create(input: LibraryMediaRelationCreateInput): Promise<LibraryMediaRelation>
  update(
    selector: LibraryMediaRelationSelector,
    patch: LibraryMediaRelationPatch
  ): Promise<LibraryMediaRelation>
  remove(selector: LibraryMediaRelationSelector): Promise<void>
}

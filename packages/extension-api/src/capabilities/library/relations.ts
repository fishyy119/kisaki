import type { LibraryEntityReference } from './entities'
import type { LibraryMediaType } from './graph'
import { LIBRARY_MEDIA_RELATION_TYPES, type LibraryMediaRelationType } from '../../shared/library'

/**
 * Kinds that state a change of medium and therefore cannot join two entries
 * of one media type. Every other kind is medium-neutral, so this is the only
 * endpoint constraint the vocabulary carries.
 */
const CROSS_MEDIA_ONLY_TYPES: ReadonlySet<LibraryMediaRelationType> =
  new Set<LibraryMediaRelationType>(['crossMedia'])

/** Whether `type` may label a directed edge from `fromType` to `toType`. */
export function isLibraryMediaRelationTypeAllowed(
  type: LibraryMediaRelationType,
  fromType: LibraryMediaType,
  toType: LibraryMediaType
): boolean {
  return fromType !== toType || !CROSS_MEDIA_ONLY_TYPES.has(type)
}

/** Kinds allowed on a directed edge from `fromType` to `toType`, in vocabulary order. */
export function listLibraryMediaRelationTypes(
  fromType: LibraryMediaType,
  toType: LibraryMediaType
): readonly LibraryMediaRelationType[] {
  return LIBRARY_MEDIA_RELATION_TYPES.filter((type) =>
    isLibraryMediaRelationTypeAllowed(type, fromType, toType)
  )
}

/**
 * One directed entry-to-entry relation between media entries.
 *
 * `(from -> to, type)` reads as "`to` is the `type` of `from`". Rows are stored
 * exactly as written; readers merge both directions through the inverse
 * vocabulary, so an extension only manages the edges it writes.
 */
export interface LibraryMediaRelation {
  from: LibraryEntityReference<LibraryMediaType>
  to: LibraryEntityReference<LibraryMediaType>
  type: LibraryMediaRelationType
  note?: string | undefined
  order?: number | undefined
  createdAt?: number | undefined
  updatedAt?: number | undefined
}

/**
 * Endpoints must reference two different existing library entries; the host
 * rejects self-edges and unknown entry ids because relation rows carry no
 * database-level referential integrity.
 */
export interface LibraryMediaRelationCreateInput {
  from: LibraryEntityReference<LibraryMediaType>
  to: LibraryEntityReference<LibraryMediaType>
  type: LibraryMediaRelationType
  note?: string | undefined
  order?: number | undefined
}

export interface LibraryMediaRelationSelector {
  from: LibraryEntityReference<LibraryMediaType>
  to: LibraryEntityReference<LibraryMediaType>
  type: LibraryMediaRelationType
}

export interface LibraryMediaRelationPatch {
  type?: LibraryMediaRelationType | undefined
  note?: string | undefined
  order?: number | undefined
}

export interface LibraryMediaRelationQuery {
  entity?: LibraryEntityReference<LibraryMediaType> | undefined
  relatedEntity?: LibraryEntityReference<LibraryMediaType> | undefined
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

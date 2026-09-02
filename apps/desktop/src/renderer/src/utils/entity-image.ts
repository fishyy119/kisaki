/**
 * Entity imagery facts.
 *
 * Which column carries an entity's picture is per-entity knowledge that cards,
 * list rows, search results, links and merge summaries all need, so it is
 * declared once here. The attachment folder is the entity's own table, so the
 * URL segment is read from the entity table registry instead of copied.
 */

import { ENTITY_TABLES, type EntityRowMap } from '@renderer/core/db'
import type { AllEntityType } from '@shared/entity-types'
import { getAttachmentUrl, type ThumbnailOptions } from './attachment'

/**
 * Which picture stands for the entity on a given surface.
 *
 * - `cover`: poster, portrait or logo, for cards, summaries and result rows.
 * - `icon`: compact rows, where a game's launcher icon reads better than its
 *   poster and falls back to it.
 */
export type EntityImageRole = 'cover' | 'icon'

type EntityImageSpecs = {
  [T in AllEntityType]: Record<EntityImageRole, (row: EntityRowMap[T]) => string | null>
}

const ENTITY_IMAGE_SPECS: EntityImageSpecs = {
  game: {
    cover: (row) => row.coverFile,
    icon: (row) => row.iconFile ?? row.coverFile
  },
  anime: {
    cover: (row) => row.coverFile,
    icon: (row) => row.coverFile
  },
  comic: {
    cover: (row) => row.coverFile,
    icon: (row) => row.coverFile
  },
  novel: {
    cover: (row) => row.coverFile,
    icon: (row) => row.coverFile
  },
  character: {
    cover: (row) => row.photoFile,
    icon: (row) => row.photoFile
  },
  person: {
    cover: (row) => row.photoFile,
    icon: (row) => row.photoFile
  },
  company: {
    cover: (row) => row.logoFile,
    icon: (row) => row.logoFile
  },
  collection: {
    cover: (row) => row.coverFile,
    icon: (row) => row.coverFile
  },
  // A tag carries no imagery of its own; surfaces fall back to the entity icon.
  tag: {
    cover: () => null,
    icon: () => null
  }
}

/** The file carrying the entity's picture for a surface, or null when it has none. */
export function getEntityImageFile<T extends AllEntityType>(
  entityType: T,
  row: EntityRowMap[T],
  role: EntityImageRole
): string | null {
  return ENTITY_IMAGE_SPECS[entityType][role](row)
}

/** URL of one of the entity's own attachment files. */
export function getEntityAttachmentUrl(
  entityType: AllEntityType,
  entityId: string,
  file: string,
  thumbnail?: ThumbnailOptions
): string {
  return getAttachmentUrl(ENTITY_TABLES[entityType].tableName, entityId, file, thumbnail)
}

/** Resolves the entity's image URL for a surface, or null when it has none. */
export function getEntityImageUrl<T extends AllEntityType>(
  entityType: T,
  row: EntityRowMap[T],
  role: EntityImageRole,
  thumbnail?: ThumbnailOptions
): string | null {
  const file = getEntityImageFile(entityType, row, role)
  if (!file) return null
  return getEntityAttachmentUrl(entityType, row.id, file, thumbnail)
}

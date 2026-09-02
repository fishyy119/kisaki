/**
 * Tag identity resolution.
 *
 * A tag's matching identity is the normalized form of its name, persisted in the
 * indexed `normalized_name` column. Every path that attaches tags resolves ids
 * through here, so add and update flows agree on what counts as the same tag.
 */

import { eq } from 'drizzle-orm'
import { tags, type Tag } from '@shared/db/schema'
import { normalizeKeyText } from '@shared/identity'
import type { DbContext } from '../types'

export interface TagIdentityInput {
  name: string
  isNsfw?: boolean
}

/** Resolves a tag by matching identity, ignoring the casing and spacing of `name`. */
export function findTagByName(ctx: DbContext, name: string): Tag | undefined {
  const normalizedName = normalizeKeyText(name)
  if (!normalizedName) return undefined

  const [row] = ctx
    .select()
    .from(tags)
    .where(eq(tags.normalizedName, normalizedName))
    .limit(1)
    .all()
  return row
}

/**
 * Resolves the tag id for a name, creating the tag when no row shares its
 * identity. Returns undefined for names that carry no identity at all, which
 * callers treat as "nothing to link".
 */
export function resolveTagId(ctx: DbContext, tag: TagIdentityInput): string | undefined {
  const name = tag.name.trim()
  if (!normalizeKeyText(name)) return undefined

  const existing = findTagByName(ctx, name)
  if (existing) return existing.id

  const [inserted] = ctx
    .insert(tags)
    .values({ name, normalizedName: name, isNsfw: tag.isNsfw ?? false })
    .returning({ id: tags.id })
    .all()

  return inserted?.id
}

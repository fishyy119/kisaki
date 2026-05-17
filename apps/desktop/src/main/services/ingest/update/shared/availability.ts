import { and, eq } from 'drizzle-orm'
import type { DbContext } from '@main/services/db'
import {
  characterExternalIds,
  companyExternalIds,
  gameExternalIds,
  personExternalIds,
  tags
} from '@shared/db'
import { normalizeExternalIds, normalizeKeyText, type ExternalId } from '@shared/identity'

export function ensurePersonExternalIdsAvailable(
  tx: DbContext,
  personId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(personExternalIds)
      .where(
        and(
          eq(personExternalIds.source, externalId.source),
          eq(personExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.personId !== personId) {
      throw new Error(
        `External ID already belongs to another person: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function ensureCompanyExternalIdsAvailable(
  tx: DbContext,
  companyId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(companyExternalIds)
      .where(
        and(
          eq(companyExternalIds.source, externalId.source),
          eq(companyExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.companyId !== companyId) {
      throw new Error(
        `External ID already belongs to another company: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function ensureCharacterExternalIdsAvailable(
  tx: DbContext,
  characterId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(characterExternalIds)
      .where(
        and(
          eq(characterExternalIds.source, externalId.source),
          eq(characterExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.characterId !== characterId) {
      throw new Error(
        `External ID already belongs to another character: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function ensureGameExternalIdsAvailable(
  tx: DbContext,
  gameId: string,
  externalIds: ExternalId[]
): void {
  for (const externalId of normalizeExternalIds(externalIds)) {
    const existing = tx
      .select()
      .from(gameExternalIds)
      .where(
        and(
          eq(gameExternalIds.source, externalId.source),
          eq(gameExternalIds.externalId, externalId.id)
        )
      )
      .limit(1)
      .all()[0]

    if (existing && existing.gameId !== gameId) {
      throw new Error(
        `External ID already belongs to another game: ${externalId.source}:${externalId.id}`
      )
    }
  }
}

export function findExistingTagId(tx: DbContext, name: string): string | undefined {
  const normalizedName = normalizeKeyText(name)
  return tx
    .select()
    .from(tags)
    .all()
    .find((row) => normalizeKeyText(row.name) === normalizedName)?.id
}

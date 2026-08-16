import { eq } from 'drizzle-orm'
import type { AllEntityType } from '@shared/common'
import {
  animes,
  characters,
  collections,
  companies,
  games,
  movies,
  persons,
  tags,
  tvs
} from '@shared/db'
import { db } from '@renderer/core/db'
import { messages } from '@renderer/core/i18n'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import type { EntityMergeSummary } from './types'

function getNameSubText(name: string, originalName: string | null | undefined): string {
  return originalName || name
}

export async function fetchEntityMergeSummary(
  entityType: AllEntityType,
  id: string
): Promise<EntityMergeSummary | null> {
  switch (entityType) {
    case 'game': {
      const row = await db.query.games.findFirst({
        columns: { id: true, name: true, originalName: true, coverFile: true },
        where: eq(games.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.coverFile
          ? getAttachmentUrl('games', row.id, row.coverFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'anime': {
      const row = await db.query.animes.findFirst({
        columns: { id: true, name: true, originalName: true, coverFile: true },
        where: eq(animes.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.coverFile
          ? getAttachmentUrl('animes', row.id, row.coverFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'tv': {
      const row = await db.query.tvs.findFirst({
        columns: { id: true, name: true, originalName: true, coverFile: true },
        where: eq(tvs.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.coverFile
          ? getAttachmentUrl('tvs', row.id, row.coverFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'movie': {
      const row = await db.query.movies.findFirst({
        columns: { id: true, name: true, originalName: true, coverFile: true },
        where: eq(movies.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.coverFile
          ? getAttachmentUrl('movies', row.id, row.coverFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'person': {
      const row = await db.query.persons.findFirst({
        columns: { id: true, name: true, originalName: true, photoFile: true },
        where: eq(persons.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.photoFile
          ? getAttachmentUrl('persons', row.id, row.photoFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'company': {
      const row = await db.query.companies.findFirst({
        columns: { id: true, name: true, originalName: true, logoFile: true },
        where: eq(companies.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.logoFile
          ? getAttachmentUrl('companies', row.id, row.logoFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'character': {
      const row = await db.query.characters.findFirst({
        columns: { id: true, name: true, originalName: true, photoFile: true },
        where: eq(characters.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: getNameSubText(row.name, row.originalName),
        imageUrl: row.photoFile
          ? getAttachmentUrl('characters', row.id, row.photoFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'collection': {
      const row = await db.query.collections.findFirst({
        columns: { id: true, name: true, coverFile: true, isDynamic: true },
        where: eq(collections.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: row.isDynamic
          ? messages.value.merge.dynamicCollection
          : messages.value.merge.staticCollection,
        imageUrl: row.coverFile
          ? getAttachmentUrl('collections', row.id, row.coverFile, { width: 96, height: 96 })
          : null
      }
    }
    case 'tag': {
      const row = await db.query.tags.findFirst({
        columns: { id: true, name: true, description: true },
        where: eq(tags.id, id)
      })
      if (!row) return null
      return {
        entityType,
        id: row.id,
        name: row.name,
        subText: row.description || row.name,
        imageUrl: null
      }
    }
  }
}

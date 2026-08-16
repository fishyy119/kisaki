/**
 * DB entity delete helper.
 *
 * Provides delete previews and executes entity deletion with optional
 * direct-related entity cleanup inside a single DB transaction.
 */

import { and, eq, inArray, or } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { AllEntityType, MediaType } from '@shared/common'
import type {
  EntityDeletePreview,
  EntityDeletePreviewItem,
  EntityDeletePreviewOption,
  EntityDeletePreviewRequest,
  EntityDeleteRequest,
  EntityDeleteResult
} from '@shared/entity-delete'
import * as schema from '@shared/db/schema'
import {
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animes,
  animeTagLinks,
  characters,
  characterPersonLinks,
  characterTagLinks,
  collections,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionMovieLinks,
  collectionPersonLinks,
  collectionTvLinks,
  companies,
  companyTagLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  games,
  gamePersonLinks,
  gameTagLinks,
  mediaRelations,
  movieCharacterLinks,
  movieCompanyLinks,
  moviePersonLinks,
  movies,
  movieTagLinks,
  persons,
  personTagLinks,
  tags,
  tvCharacterLinks,
  tvCompanyLinks,
  tvPersonLinks,
  tvs,
  tvTagLinks
} from '@shared/db/schema'
import type { DbContext } from '../types'

const DIRECT_RELATED_ENTITY_TYPES: Record<AllEntityType, readonly AllEntityType[]> = {
  game: ['character', 'person', 'company', 'tag'],
  anime: ['character', 'person', 'company', 'tag'],
  tv: ['character', 'person', 'company', 'tag'],
  movie: ['character', 'person', 'company', 'tag'],
  character: ['game', 'anime', 'tv', 'movie', 'person', 'tag'],
  person: ['game', 'anime', 'tv', 'movie', 'character', 'tag'],
  company: ['game', 'anime', 'tv', 'movie', 'tag'],
  tag: ['game', 'anime', 'tv', 'movie', 'character', 'person', 'company'],
  collection: ['game', 'anime', 'tv', 'movie', 'character', 'person', 'company']
}

type RelatedIdMap = Partial<Record<AllEntityType, Set<string>>>

export class DbEntityDeleteHelper {
  constructor(private db: BetterSQLite3Database<typeof schema>) {}

  /**
   * Build delete preview data for the requested entities.
   */
  preview(params: EntityDeletePreviewRequest): EntityDeletePreview {
    const entityIds = this.normalizeIds(params.entityIds)
    if (entityIds.length === 0) {
      return {
        entityType: params.entityType,
        items: [],
        relatedOptions: []
      }
    }

    const items = this.getEntityItems(params.entityType, entityIds)
    const resolvedIds = items.map((item) => item.id)
    const relatedIds = this.collectRelatedIds(params.entityType, resolvedIds)

    return {
      entityType: params.entityType,
      items,
      relatedOptions: this.buildRelatedOptions(params.entityType, relatedIds)
    }
  }

  /**
   * Delete root entities and any selected direct-related entities.
   */
  delete(params: EntityDeleteRequest): EntityDeleteResult {
    const requestedIds = this.normalizeIds(params.entityIds)
    if (requestedIds.length === 0) {
      return { deletedCounts: {} }
    }

    const items = this.getEntityItems(params.entityType, requestedIds)
    const entityIds = items.map((item) => item.id)
    if (entityIds.length === 0) {
      return { deletedCounts: {} }
    }

    const allowedRelatedTypes = new Set(DIRECT_RELATED_ENTITY_TYPES[params.entityType])
    const deleteRelatedTypes = this.normalizeIds(params.deleteRelatedTypes ?? []).filter(
      (entityType): entityType is AllEntityType =>
        allowedRelatedTypes.has(entityType as AllEntityType)
    )
    const relatedIds = this.collectRelatedIds(params.entityType, entityIds)
    const deletedCounts: Partial<Record<AllEntityType, number>> = {}

    this.db.transaction((tx) => {
      for (const entityType of deleteRelatedTypes) {
        const ids = [...(relatedIds[entityType] ?? [])]
        if (ids.length === 0) continue

        this.deleteEntitiesByType(entityType, ids, tx)
        deletedCounts[entityType] = ids.length
      }

      this.deleteEntitiesByType(params.entityType, entityIds, tx)
      deletedCounts[params.entityType] = entityIds.length
    })

    return { deletedCounts }
  }

  private buildRelatedOptions(
    entityType: AllEntityType,
    relatedIds: RelatedIdMap
  ): EntityDeletePreviewOption[] {
    return DIRECT_RELATED_ENTITY_TYPES[entityType]
      .map((relatedType): EntityDeletePreviewOption => ({
        entityType: relatedType,
        count: relatedIds[relatedType]?.size ?? 0
      }))
      .filter((option) => option.count > 0)
  }

  private collectRelatedIds(entityType: AllEntityType, entityIds: string[]): RelatedIdMap {
    if (entityIds.length === 0) return {}

    switch (entityType) {
      case 'game':
        return {
          character: this.selectDistinctIds(
            gameCharacterLinks,
            gameCharacterLinks.gameId,
            gameCharacterLinks.characterId,
            entityIds
          ),
          person: this.selectDistinctIds(
            gamePersonLinks,
            gamePersonLinks.gameId,
            gamePersonLinks.personId,
            entityIds
          ),
          company: this.selectDistinctIds(
            gameCompanyLinks,
            gameCompanyLinks.gameId,
            gameCompanyLinks.companyId,
            entityIds
          ),
          tag: this.selectDistinctIds(
            gameTagLinks,
            gameTagLinks.gameId,
            gameTagLinks.tagId,
            entityIds
          )
        }
      case 'anime':
        return {
          character: this.selectDistinctIds(
            animeCharacterLinks,
            animeCharacterLinks.animeId,
            animeCharacterLinks.characterId,
            entityIds
          ),
          person: this.selectDistinctIds(
            animePersonLinks,
            animePersonLinks.animeId,
            animePersonLinks.personId,
            entityIds
          ),
          company: this.selectDistinctIds(
            animeCompanyLinks,
            animeCompanyLinks.animeId,
            animeCompanyLinks.companyId,
            entityIds
          ),
          tag: this.selectDistinctIds(
            animeTagLinks,
            animeTagLinks.animeId,
            animeTagLinks.tagId,
            entityIds
          )
        }
      case 'tv':
        return {
          character: this.selectDistinctIds(
            tvCharacterLinks,
            tvCharacterLinks.tvId,
            tvCharacterLinks.characterId,
            entityIds
          ),
          person: this.selectDistinctIds(
            tvPersonLinks,
            tvPersonLinks.tvId,
            tvPersonLinks.personId,
            entityIds
          ),
          company: this.selectDistinctIds(
            tvCompanyLinks,
            tvCompanyLinks.tvId,
            tvCompanyLinks.companyId,
            entityIds
          ),
          tag: this.selectDistinctIds(tvTagLinks, tvTagLinks.tvId, tvTagLinks.tagId, entityIds)
        }
      case 'movie':
        return {
          character: this.selectDistinctIds(
            movieCharacterLinks,
            movieCharacterLinks.movieId,
            movieCharacterLinks.characterId,
            entityIds
          ),
          person: this.selectDistinctIds(
            moviePersonLinks,
            moviePersonLinks.movieId,
            moviePersonLinks.personId,
            entityIds
          ),
          company: this.selectDistinctIds(
            movieCompanyLinks,
            movieCompanyLinks.movieId,
            movieCompanyLinks.companyId,
            entityIds
          ),
          tag: this.selectDistinctIds(
            movieTagLinks,
            movieTagLinks.movieId,
            movieTagLinks.tagId,
            entityIds
          )
        }
      case 'character':
        return {
          game: this.selectDistinctIds(
            gameCharacterLinks,
            gameCharacterLinks.characterId,
            gameCharacterLinks.gameId,
            entityIds
          ),
          anime: this.selectDistinctIds(
            animeCharacterLinks,
            animeCharacterLinks.characterId,
            animeCharacterLinks.animeId,
            entityIds
          ),
          tv: this.selectDistinctIds(
            tvCharacterLinks,
            tvCharacterLinks.characterId,
            tvCharacterLinks.tvId,
            entityIds
          ),
          movie: this.selectDistinctIds(
            movieCharacterLinks,
            movieCharacterLinks.characterId,
            movieCharacterLinks.movieId,
            entityIds
          ),
          person: this.selectDistinctIds(
            characterPersonLinks,
            characterPersonLinks.characterId,
            characterPersonLinks.personId,
            entityIds
          ),
          tag: this.selectDistinctIds(
            characterTagLinks,
            characterTagLinks.characterId,
            characterTagLinks.tagId,
            entityIds
          )
        }
      case 'person':
        return {
          game: this.selectDistinctIds(
            gamePersonLinks,
            gamePersonLinks.personId,
            gamePersonLinks.gameId,
            entityIds
          ),
          anime: this.selectDistinctIds(
            animePersonLinks,
            animePersonLinks.personId,
            animePersonLinks.animeId,
            entityIds
          ),
          tv: this.selectDistinctIds(
            tvPersonLinks,
            tvPersonLinks.personId,
            tvPersonLinks.tvId,
            entityIds
          ),
          movie: this.selectDistinctIds(
            moviePersonLinks,
            moviePersonLinks.personId,
            moviePersonLinks.movieId,
            entityIds
          ),
          character: this.selectDistinctIds(
            characterPersonLinks,
            characterPersonLinks.personId,
            characterPersonLinks.characterId,
            entityIds
          ),
          tag: this.selectDistinctIds(
            personTagLinks,
            personTagLinks.personId,
            personTagLinks.tagId,
            entityIds
          )
        }
      case 'company':
        return {
          game: this.selectDistinctIds(
            gameCompanyLinks,
            gameCompanyLinks.companyId,
            gameCompanyLinks.gameId,
            entityIds
          ),
          anime: this.selectDistinctIds(
            animeCompanyLinks,
            animeCompanyLinks.companyId,
            animeCompanyLinks.animeId,
            entityIds
          ),
          tv: this.selectDistinctIds(
            tvCompanyLinks,
            tvCompanyLinks.companyId,
            tvCompanyLinks.tvId,
            entityIds
          ),
          movie: this.selectDistinctIds(
            movieCompanyLinks,
            movieCompanyLinks.companyId,
            movieCompanyLinks.movieId,
            entityIds
          ),
          tag: this.selectDistinctIds(
            companyTagLinks,
            companyTagLinks.companyId,
            companyTagLinks.tagId,
            entityIds
          )
        }
      case 'tag':
        return {
          game: this.selectDistinctIds(
            gameTagLinks,
            gameTagLinks.tagId,
            gameTagLinks.gameId,
            entityIds
          ),
          anime: this.selectDistinctIds(
            animeTagLinks,
            animeTagLinks.tagId,
            animeTagLinks.animeId,
            entityIds
          ),
          tv: this.selectDistinctIds(tvTagLinks, tvTagLinks.tagId, tvTagLinks.tvId, entityIds),
          movie: this.selectDistinctIds(
            movieTagLinks,
            movieTagLinks.tagId,
            movieTagLinks.movieId,
            entityIds
          ),
          character: this.selectDistinctIds(
            characterTagLinks,
            characterTagLinks.tagId,
            characterTagLinks.characterId,
            entityIds
          ),
          person: this.selectDistinctIds(
            personTagLinks,
            personTagLinks.tagId,
            personTagLinks.personId,
            entityIds
          ),
          company: this.selectDistinctIds(
            companyTagLinks,
            companyTagLinks.tagId,
            companyTagLinks.companyId,
            entityIds
          )
        }
      case 'collection':
        return {
          game: this.selectDistinctIds(
            collectionGameLinks,
            collectionGameLinks.collectionId,
            collectionGameLinks.gameId,
            entityIds
          ),
          anime: this.selectDistinctIds(
            collectionAnimeLinks,
            collectionAnimeLinks.collectionId,
            collectionAnimeLinks.animeId,
            entityIds
          ),
          tv: this.selectDistinctIds(
            collectionTvLinks,
            collectionTvLinks.collectionId,
            collectionTvLinks.tvId,
            entityIds
          ),
          movie: this.selectDistinctIds(
            collectionMovieLinks,
            collectionMovieLinks.collectionId,
            collectionMovieLinks.movieId,
            entityIds
          ),
          character: this.selectDistinctIds(
            collectionCharacterLinks,
            collectionCharacterLinks.collectionId,
            collectionCharacterLinks.characterId,
            entityIds
          ),
          person: this.selectDistinctIds(
            collectionPersonLinks,
            collectionPersonLinks.collectionId,
            collectionPersonLinks.personId,
            entityIds
          ),
          company: this.selectDistinctIds(
            collectionCompanyLinks,
            collectionCompanyLinks.collectionId,
            collectionCompanyLinks.companyId,
            entityIds
          )
        }
    }
  }

  private getEntityItems(
    entityType: AllEntityType,
    entityIds: string[]
  ): EntityDeletePreviewItem[] {
    if (entityIds.length === 0) return []

    switch (entityType) {
      case 'game':
        return this.db
          .select({ id: games.id, name: games.name })
          .from(games)
          .where(inArray(games.id, entityIds))
          .all()
      case 'anime':
        return this.db
          .select({ id: animes.id, name: animes.name })
          .from(animes)
          .where(inArray(animes.id, entityIds))
          .all()
      case 'tv':
        return this.db
          .select({ id: tvs.id, name: tvs.name })
          .from(tvs)
          .where(inArray(tvs.id, entityIds))
          .all()
      case 'movie':
        return this.db
          .select({ id: movies.id, name: movies.name })
          .from(movies)
          .where(inArray(movies.id, entityIds))
          .all()
      case 'character':
        return this.db
          .select({ id: characters.id, name: characters.name })
          .from(characters)
          .where(inArray(characters.id, entityIds))
          .all()
      case 'person':
        return this.db
          .select({ id: persons.id, name: persons.name })
          .from(persons)
          .where(inArray(persons.id, entityIds))
          .all()
      case 'company':
        return this.db
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(inArray(companies.id, entityIds))
          .all()
      case 'tag':
        return this.db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(inArray(tags.id, entityIds))
          .all()
      case 'collection':
        return this.db
          .select({ id: collections.id, name: collections.name })
          .from(collections)
          .where(inArray(collections.id, entityIds))
          .all()
    }
  }

  private deleteEntitiesByType(
    entityType: AllEntityType,
    entityIds: string[],
    ctx?: DbContext
  ): void {
    const db = ctx ?? this.db
    if (entityIds.length === 0) return

    switch (entityType) {
      case 'game':
        db.delete(games).where(inArray(games.id, entityIds)).run()
        this.deleteMediaRelationEnds(db, 'game', entityIds)
        return
      case 'anime':
        db.delete(animes).where(inArray(animes.id, entityIds)).run()
        this.deleteMediaRelationEnds(db, 'anime', entityIds)
        return
      case 'tv':
        db.delete(tvs).where(inArray(tvs.id, entityIds)).run()
        this.deleteMediaRelationEnds(db, 'tv', entityIds)
        return
      case 'movie':
        db.delete(movies).where(inArray(movies.id, entityIds)).run()
        this.deleteMediaRelationEnds(db, 'movie', entityIds)
        return
      case 'character':
        db.delete(characters).where(inArray(characters.id, entityIds)).run()
        return
      case 'person':
        db.delete(persons).where(inArray(persons.id, entityIds)).run()
        return
      case 'company':
        db.delete(companies).where(inArray(companies.id, entityIds)).run()
        return
      case 'tag':
        db.delete(tags).where(inArray(tags.id, entityIds)).run()
        return
      case 'collection':
        db.delete(collections).where(inArray(collections.id, entityIds)).run()
        return
    }
  }

  /** media_relations carries no FKs; both polymorphic ends clear at this choke point. */
  private deleteMediaRelationEnds(
    db: DbContext | BetterSQLite3Database<typeof schema>,
    mediaType: MediaType,
    entityIds: string[]
  ): void {
    db.delete(mediaRelations)
      .where(
        or(
          and(eq(mediaRelations.fromType, mediaType), inArray(mediaRelations.fromId, entityIds)),
          and(eq(mediaRelations.toType, mediaType), inArray(mediaRelations.toId, entityIds))
        )
      )
      .run()
  }

  private normalizeIds(ids: readonly string[]): string[] {
    return [...new Set(ids.filter((id): id is string => Boolean(id)))]
  }

  /** Query distinct target IDs from a junction table given its schema facts. */
  private selectDistinctIds(
    table: SQLiteTable,
    sourceColumn: AnySQLiteColumn,
    targetColumn: AnySQLiteColumn,
    sourceIds: string[]
  ): Set<string> {
    if (sourceIds.length === 0) return new Set()

    const rows = this.db
      .selectDistinct({ id: targetColumn })
      .from(table)
      .where(inArray(sourceColumn, sourceIds))
      .all()

    return new Set(rows.flatMap((row) => (typeof row.id === 'string' && row.id ? [row.id] : [])))
  }
}

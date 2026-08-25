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
  animeCastLinks,
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
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  comics,
  comicTagLinks,
  companies,
  companyTagLinks,
  gameCastLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  games,
  gamePersonLinks,
  gameTagLinks,
  mediaRelations,
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks,
  novels,
  novelTagLinks,
  persons,
  personTagLinks,
  tags
} from '@shared/db/schema'
import type { DbContext } from '../types'

const DIRECT_RELATED_ENTITY_TYPES: Record<AllEntityType, readonly AllEntityType[]> = {
  game: ['character', 'person', 'company', 'tag'],
  anime: ['character', 'person', 'company', 'tag'],
  comic: ['character', 'person', 'company', 'tag'],
  novel: ['character', 'person', 'company', 'tag'],
  character: ['game', 'anime', 'comic', 'novel', 'person', 'tag'],
  person: ['game', 'anime', 'comic', 'novel', 'character', 'tag'],
  company: ['game', 'anime', 'comic', 'novel', 'tag'],
  tag: ['game', 'anime', 'comic', 'novel', 'character', 'person', 'company'],
  collection: ['game', 'anime', 'comic', 'novel', 'character', 'person', 'company']
}

type RelatedIdMap = Partial<Record<AllEntityType, Set<string>>>

/** One junction table read from one side: the table, its source and target columns. */
type JunctionEdge = readonly [SQLiteTable, AnySQLiteColumn, AnySQLiteColumn]

export class EntityDeleteCoordinator {
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
  apply(params: EntityDeleteRequest): EntityDeleteResult {
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
            entityIds,
            [gameCharacterLinks, gameCharacterLinks.gameId, gameCharacterLinks.characterId],
            [gameCastLinks, gameCastLinks.gameId, gameCastLinks.characterId]
          ),
          person: this.selectDistinctIds(
            entityIds,
            [gamePersonLinks, gamePersonLinks.gameId, gamePersonLinks.personId],
            [gameCastLinks, gameCastLinks.gameId, gameCastLinks.personId]
          ),
          company: this.selectDistinctIds(entityIds, [
            gameCompanyLinks,
            gameCompanyLinks.gameId,
            gameCompanyLinks.companyId
          ]),
          tag: this.selectDistinctIds(entityIds, [
            gameTagLinks,
            gameTagLinks.gameId,
            gameTagLinks.tagId
          ])
        }
      case 'anime':
        return {
          character: this.selectDistinctIds(
            entityIds,
            [animeCharacterLinks, animeCharacterLinks.animeId, animeCharacterLinks.characterId],
            [animeCastLinks, animeCastLinks.animeId, animeCastLinks.characterId]
          ),
          person: this.selectDistinctIds(
            entityIds,
            [animePersonLinks, animePersonLinks.animeId, animePersonLinks.personId],
            [animeCastLinks, animeCastLinks.animeId, animeCastLinks.personId]
          ),
          company: this.selectDistinctIds(entityIds, [
            animeCompanyLinks,
            animeCompanyLinks.animeId,
            animeCompanyLinks.companyId
          ]),
          tag: this.selectDistinctIds(entityIds, [
            animeTagLinks,
            animeTagLinks.animeId,
            animeTagLinks.tagId
          ])
        }
      case 'comic':
        return {
          character: this.selectDistinctIds(entityIds, [
            comicCharacterLinks,
            comicCharacterLinks.comicId,
            comicCharacterLinks.characterId
          ]),
          person: this.selectDistinctIds(entityIds, [
            comicPersonLinks,
            comicPersonLinks.comicId,
            comicPersonLinks.personId
          ]),
          company: this.selectDistinctIds(entityIds, [
            comicCompanyLinks,
            comicCompanyLinks.comicId,
            comicCompanyLinks.companyId
          ]),
          tag: this.selectDistinctIds(entityIds, [
            comicTagLinks,
            comicTagLinks.comicId,
            comicTagLinks.tagId
          ])
        }
      case 'novel':
        return {
          character: this.selectDistinctIds(entityIds, [
            novelCharacterLinks,
            novelCharacterLinks.novelId,
            novelCharacterLinks.characterId
          ]),
          person: this.selectDistinctIds(entityIds, [
            novelPersonLinks,
            novelPersonLinks.novelId,
            novelPersonLinks.personId
          ]),
          company: this.selectDistinctIds(entityIds, [
            novelCompanyLinks,
            novelCompanyLinks.novelId,
            novelCompanyLinks.companyId
          ]),
          tag: this.selectDistinctIds(entityIds, [
            novelTagLinks,
            novelTagLinks.novelId,
            novelTagLinks.tagId
          ])
        }
      case 'character':
        return {
          game: this.selectDistinctIds(
            entityIds,
            [gameCharacterLinks, gameCharacterLinks.characterId, gameCharacterLinks.gameId],
            [gameCastLinks, gameCastLinks.characterId, gameCastLinks.gameId]
          ),
          anime: this.selectDistinctIds(
            entityIds,
            [animeCharacterLinks, animeCharacterLinks.characterId, animeCharacterLinks.animeId],
            [animeCastLinks, animeCastLinks.characterId, animeCastLinks.animeId]
          ),
          comic: this.selectDistinctIds(entityIds, [
            comicCharacterLinks,
            comicCharacterLinks.characterId,
            comicCharacterLinks.comicId
          ]),
          novel: this.selectDistinctIds(entityIds, [
            novelCharacterLinks,
            novelCharacterLinks.characterId,
            novelCharacterLinks.novelId
          ]),
          person: this.selectDistinctIds(
            entityIds,
            [characterPersonLinks, characterPersonLinks.characterId, characterPersonLinks.personId],
            [gameCastLinks, gameCastLinks.characterId, gameCastLinks.personId],
            [animeCastLinks, animeCastLinks.characterId, animeCastLinks.personId]
          ),
          tag: this.selectDistinctIds(entityIds, [
            characterTagLinks,
            characterTagLinks.characterId,
            characterTagLinks.tagId
          ])
        }
      case 'person':
        return {
          game: this.selectDistinctIds(
            entityIds,
            [gamePersonLinks, gamePersonLinks.personId, gamePersonLinks.gameId],
            [gameCastLinks, gameCastLinks.personId, gameCastLinks.gameId]
          ),
          anime: this.selectDistinctIds(
            entityIds,
            [animePersonLinks, animePersonLinks.personId, animePersonLinks.animeId],
            [animeCastLinks, animeCastLinks.personId, animeCastLinks.animeId]
          ),
          comic: this.selectDistinctIds(entityIds, [
            comicPersonLinks,
            comicPersonLinks.personId,
            comicPersonLinks.comicId
          ]),
          novel: this.selectDistinctIds(entityIds, [
            novelPersonLinks,
            novelPersonLinks.personId,
            novelPersonLinks.novelId
          ]),
          character: this.selectDistinctIds(
            entityIds,
            [characterPersonLinks, characterPersonLinks.personId, characterPersonLinks.characterId],
            [gameCastLinks, gameCastLinks.personId, gameCastLinks.characterId],
            [animeCastLinks, animeCastLinks.personId, animeCastLinks.characterId]
          ),
          tag: this.selectDistinctIds(entityIds, [
            personTagLinks,
            personTagLinks.personId,
            personTagLinks.tagId
          ])
        }
      case 'company':
        return {
          game: this.selectDistinctIds(entityIds, [
            gameCompanyLinks,
            gameCompanyLinks.companyId,
            gameCompanyLinks.gameId
          ]),
          anime: this.selectDistinctIds(entityIds, [
            animeCompanyLinks,
            animeCompanyLinks.companyId,
            animeCompanyLinks.animeId
          ]),
          comic: this.selectDistinctIds(entityIds, [
            comicCompanyLinks,
            comicCompanyLinks.companyId,
            comicCompanyLinks.comicId
          ]),
          novel: this.selectDistinctIds(entityIds, [
            novelCompanyLinks,
            novelCompanyLinks.companyId,
            novelCompanyLinks.novelId
          ]),
          tag: this.selectDistinctIds(entityIds, [
            companyTagLinks,
            companyTagLinks.companyId,
            companyTagLinks.tagId
          ])
        }
      case 'tag':
        return {
          game: this.selectDistinctIds(entityIds, [
            gameTagLinks,
            gameTagLinks.tagId,
            gameTagLinks.gameId
          ]),
          anime: this.selectDistinctIds(entityIds, [
            animeTagLinks,
            animeTagLinks.tagId,
            animeTagLinks.animeId
          ]),
          comic: this.selectDistinctIds(entityIds, [
            comicTagLinks,
            comicTagLinks.tagId,
            comicTagLinks.comicId
          ]),
          novel: this.selectDistinctIds(entityIds, [
            novelTagLinks,
            novelTagLinks.tagId,
            novelTagLinks.novelId
          ]),
          character: this.selectDistinctIds(entityIds, [
            characterTagLinks,
            characterTagLinks.tagId,
            characterTagLinks.characterId
          ]),
          person: this.selectDistinctIds(entityIds, [
            personTagLinks,
            personTagLinks.tagId,
            personTagLinks.personId
          ]),
          company: this.selectDistinctIds(entityIds, [
            companyTagLinks,
            companyTagLinks.tagId,
            companyTagLinks.companyId
          ])
        }
      case 'collection':
        return {
          game: this.selectDistinctIds(entityIds, [
            collectionGameLinks,
            collectionGameLinks.collectionId,
            collectionGameLinks.gameId
          ]),
          anime: this.selectDistinctIds(entityIds, [
            collectionAnimeLinks,
            collectionAnimeLinks.collectionId,
            collectionAnimeLinks.animeId
          ]),
          comic: this.selectDistinctIds(entityIds, [
            collectionComicLinks,
            collectionComicLinks.collectionId,
            collectionComicLinks.comicId
          ]),
          novel: this.selectDistinctIds(entityIds, [
            collectionNovelLinks,
            collectionNovelLinks.collectionId,
            collectionNovelLinks.novelId
          ]),
          character: this.selectDistinctIds(entityIds, [
            collectionCharacterLinks,
            collectionCharacterLinks.collectionId,
            collectionCharacterLinks.characterId
          ]),
          person: this.selectDistinctIds(entityIds, [
            collectionPersonLinks,
            collectionPersonLinks.collectionId,
            collectionPersonLinks.personId
          ]),
          company: this.selectDistinctIds(entityIds, [
            collectionCompanyLinks,
            collectionCompanyLinks.collectionId,
            collectionCompanyLinks.companyId
          ])
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
      case 'comic':
        return this.db
          .select({ id: comics.id, name: comics.name })
          .from(comics)
          .where(inArray(comics.id, entityIds))
          .all()
      case 'novel':
        return this.db
          .select({ id: novels.id, name: novels.name })
          .from(novels)
          .where(inArray(novels.id, entityIds))
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
      case 'comic':
        db.delete(comics).where(inArray(comics.id, entityIds)).run()
        this.deleteMediaRelationEnds(db, 'comic', entityIds)
        return
      case 'novel':
        db.delete(novels).where(inArray(novels.id, entityIds)).run()
        this.deleteMediaRelationEnds(db, 'novel', entityIds)
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

  /**
   * Distinct target ids reachable from the source ids, unioned over every
   * junction table that carries the pair. Two entities count as related when
   * any one table joins them, so a credit stated only by a cast row is a
   * relation like any other.
   */
  private selectDistinctIds(sourceIds: string[], ...edges: readonly JunctionEdge[]): Set<string> {
    const ids = new Set<string>()
    if (sourceIds.length === 0) return ids

    for (const [table, sourceColumn, targetColumn] of edges) {
      const rows = this.db
        .selectDistinct({ id: targetColumn })
        .from(table)
        .where(inArray(sourceColumn, sourceIds))
        .all()

      for (const row of rows) {
        if (typeof row.id === 'string' && row.id) ids.add(row.id)
      }
    }

    return ids
  }
}

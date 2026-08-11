import type {
  ExternalId,
  LibraryAnimeEpisode,
  LibraryAnimeEpisodeCreateInput,
  LibraryAnimeEpisodeQuery,
  LibraryAnimeEpisodeWatchStatePatch
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  ensureNonEmptyString,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, asc, eq, isNotNull, isNull, inArray, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { animeEpisodeExternalIds, animeEpisodes, animes } from '@shared/db'
import type { DbService } from '@main/services/db'
import { loadExternalIds, syncExternalIds } from './external-ids'
import type { ExternalIdConfig } from './types'
import { optionalValue, stripUndefined, toNullableTimestampMs, toTimestampMs } from './utils'

const EPISODE_EXTERNAL_IDS_CONFIG = {
  table: animeEpisodeExternalIds,
  entityIdColumn: animeEpisodeExternalIds.episodeId,
  sourceColumn: animeEpisodeExternalIds.source,
  externalIdColumn: animeEpisodeExternalIds.externalId,
  orderColumn: animeEpisodeExternalIds.orderInEpisode,
  toEntityId(row) {
    return row.episodeId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      episodeId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInEpisode: order
    }
  }
} satisfies ExternalIdConfig<typeof animeEpisodeExternalIds>

export interface ExtensionLibraryEpisodeStoreOptions {
  db: DbService
}

/**
 * Episodes are owned by their anime entry rather than being a library entity
 * type: every read and write is addressed through an anime id, and identity is
 * resolved by external id first, episode number second.
 */
export class ExtensionLibraryEpisodeStore {
  constructor(private readonly options: ExtensionLibraryEpisodeStoreOptions) {}

  list(query: LibraryAnimeEpisodeQuery): readonly LibraryAnimeEpisode[] {
    ensureNonEmptyString(query.animeId, 'library anime id')

    try {
      const conditions: SQL[] = [eq(animeEpisodes.animeId, query.animeId)]
      if (query.types?.length) {
        conditions.push(inArray(animeEpisodes.type, [...query.types]))
      }
      if (query.watchedOnly) {
        conditions.push(isNotNull(animeEpisodes.watchedAt))
      }
      if (query.unwatchedOnly) {
        conditions.push(isNull(animeEpisodes.watchedAt))
      }

      const rows = this.options.db.client
        .select()
        .from(animeEpisodes)
        .where(and(...conditions))
        .orderBy(asc(animeEpisodes.orderInAnime), asc(animeEpisodes.createdAt))
        .all()

      const externalIds = loadExternalIds(
        this.options.db.client,
        EPISODE_EXTERNAL_IDS_CONFIG,
        rows.map((row) => row.id)
      )
      return rows.map((row) => toEpisodeDto(row, externalIds.get(row.id) ?? []))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list the anime episodes.')
    }
  }

  get(episodeId: string): LibraryAnimeEpisode | null {
    ensureNonEmptyString(episodeId, 'library anime episode id')

    try {
      const row = this.options.db.client
        .select()
        .from(animeEpisodes)
        .where(eq(animeEpisodes.id, episodeId))
        .get()
      if (!row) {
        return null
      }

      const externalIds =
        loadExternalIds(this.options.db.client, EPISODE_EXTERNAL_IDS_CONFIG, [episodeId]).get(
          episodeId
        ) ?? []
      return toEpisodeDto(row, externalIds)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the anime episode.')
    }
  }

  create(animeId: string, input: LibraryAnimeEpisodeCreateInput): LibraryAnimeEpisode {
    ensureNonEmptyString(animeId, 'library anime id')

    try {
      const id = nanoid()
      this.options.db.client.transaction((tx) => {
        const owner = tx.select({ id: animes.id }).from(animes).where(eq(animes.id, animeId)).get()
        if (!owner) {
          throw createNotFoundError(`Library anime "${animeId}" was not found.`)
        }

        tx.insert(animeEpisodes)
          .values({
            id,
            animeId,
            type: input.type,
            episodeNumber: input.episodeNumber,
            name: input.name,
            originalName: input.originalName,
            airDate: input.airDate,
            description: input.description,
            durationMs: input.durationMs,
            orderInAnime: input.order
          })
          .run()
        syncExternalIds(tx, EPISODE_EXTERNAL_IDS_CONFIG, id, input.externalIds)
      })

      return this.require(id)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the anime episode.')
    }
  }

  /**
   * The create input doubles as the patch shape: episodes have no create-only
   * fields, and `stripUndefined` below skips every absent field, so an update
   * merges rather than replaces.
   */
  update(episodeId: string, input: LibraryAnimeEpisodeCreateInput): LibraryAnimeEpisode {
    ensureNonEmptyString(episodeId, 'library anime episode id')

    try {
      this.options.db.client.transaction((tx) => {
        const existing = tx
          .select({ id: animeEpisodes.id })
          .from(animeEpisodes)
          .where(eq(animeEpisodes.id, episodeId))
          .get()
        if (!existing) {
          throw createNotFoundError(`Library anime episode "${episodeId}" was not found.`)
        }

        const values = stripUndefined({
          type: input.type,
          episodeNumber: input.episodeNumber,
          name: input.name,
          originalName: input.originalName,
          airDate: input.airDate,
          description: input.description,
          durationMs: input.durationMs,
          orderInAnime: input.order
        })
        if (Object.keys(values).length > 0) {
          tx.update(animeEpisodes).set(values).where(eq(animeEpisodes.id, episodeId)).run()
        }

        if (input.externalIds) {
          syncExternalIds(tx, EPISODE_EXTERNAL_IDS_CONFIG, episodeId, input.externalIds)
        }
      })

      return this.require(episodeId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the anime episode.')
    }
  }

  patchWatchState(
    episodeId: string,
    patch: LibraryAnimeEpisodeWatchStatePatch
  ): LibraryAnimeEpisode {
    ensureNonEmptyString(episodeId, 'library anime episode id')

    try {
      const values = stripUndefined({
        watchedAt:
          patch.watchedAt === undefined
            ? undefined
            : patch.watchedAt === null
              ? null
              : new Date(patch.watchedAt),
        playCount: patch.playCount,
        resumePositionMs: patch.resumePositionMs
      })

      const existing = this.options.db.client
        .select({ id: animeEpisodes.id })
        .from(animeEpisodes)
        .where(eq(animeEpisodes.id, episodeId))
        .get()
      if (!existing) {
        throw createNotFoundError(`Library anime episode "${episodeId}" was not found.`)
      }

      if (Object.keys(values).length > 0) {
        this.options.db.client
          .update(animeEpisodes)
          .set(values)
          .where(eq(animeEpisodes.id, episodeId))
          .run()
      }

      return this.require(episodeId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the anime episode watch state.')
    }
  }

  remove(episodeId: string): void {
    ensureNonEmptyString(episodeId, 'library anime episode id')

    try {
      this.options.db.client.delete(animeEpisodes).where(eq(animeEpisodes.id, episodeId)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the anime episode.')
    }
  }

  /** Resolves an incoming episode to an existing row: external id first, then number. */
  findMatch(
    animeId: string,
    input: Pick<LibraryAnimeEpisodeCreateInput, 'externalIds' | 'episodeNumber' | 'type'>
  ): LibraryAnimeEpisode | null {
    for (const externalId of input.externalIds ?? []) {
      const row = this.options.db.client
        .select({ episodeId: animeEpisodeExternalIds.episodeId })
        .from(animeEpisodeExternalIds)
        .innerJoin(animeEpisodes, eq(animeEpisodes.id, animeEpisodeExternalIds.episodeId))
        .where(
          and(
            eq(animeEpisodes.animeId, animeId),
            eq(animeEpisodeExternalIds.source, externalId.source),
            eq(animeEpisodeExternalIds.externalId, externalId.id)
          )
        )
        .get()
      if (row) {
        return this.get(row.episodeId)
      }
    }

    if (input.episodeNumber === undefined || input.episodeNumber === null) {
      return null
    }

    const row = this.options.db.client
      .select({ id: animeEpisodes.id })
      .from(animeEpisodes)
      .where(
        and(
          eq(animeEpisodes.animeId, animeId),
          eq(animeEpisodes.type, input.type ?? 'regular'),
          eq(animeEpisodes.episodeNumber, input.episodeNumber)
        )
      )
      .get()
    return row ? this.get(row.id) : null
  }

  private require(episodeId: string): LibraryAnimeEpisode {
    const episode = this.get(episodeId)
    if (!episode) {
      throw createNotFoundError(`Library anime episode "${episodeId}" was not found.`)
    }

    return episode
  }
}

function toEpisodeDto(
  row: typeof animeEpisodes.$inferSelect,
  externalIds: readonly ExternalId[]
): LibraryAnimeEpisode {
  return {
    id: row.id,
    animeId: row.animeId,
    type: row.type,
    episodeNumber: row.episodeNumber,
    name: optionalValue(row.name),
    originalName: optionalValue(row.originalName),
    airDate: optionalValue(row.airDate),
    description: optionalValue(row.description),
    stillFile: optionalValue(row.stillFile),
    durationMs: row.durationMs,
    watchedAt: toNullableTimestampMs(row.watchedAt),
    playCount: row.playCount,
    resumePositionMs: row.resumePositionMs,
    orderInAnime: row.orderInAnime,
    externalIds,
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt)
  }
}

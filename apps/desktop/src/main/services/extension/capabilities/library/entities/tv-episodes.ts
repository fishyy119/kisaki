import type {
  ExternalId,
  LibraryTvEpisode,
  LibraryTvEpisodeCreateInput,
  LibraryTvEpisodeQuery,
  LibraryTvEpisodeWatchStatePatch,
  LibraryTvSeason,
  LibraryTvSeasonCreateInput,
  LibraryTvSeasonQuery
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  createValidationError,
  ensureNonEmptyString,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, asc, eq, inArray, ne, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { tvEpisodeExternalIds, tvEpisodes, tvSeasons, tvs } from '@shared/db'
import type { DbService } from '@main/services/db'
import { loadExternalIds, syncExternalIds } from './external-ids'
import type { ExternalIdConfig } from './types'
import { optionalValue, stripUndefined, toNullableTimestampMs, toTimestampMs } from './utils'

const TV_EPISODE_EXTERNAL_IDS_CONFIG = {
  table: tvEpisodeExternalIds,
  entityIdColumn: tvEpisodeExternalIds.episodeId,
  sourceColumn: tvEpisodeExternalIds.source,
  externalIdColumn: tvEpisodeExternalIds.externalId,
  orderColumn: tvEpisodeExternalIds.orderInEpisode,
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
} satisfies ExternalIdConfig<typeof tvEpisodeExternalIds>

export interface ExtensionLibraryTvStoreOptions {
  db: DbService
}

/**
 * Seasons and episodes owned by a tv entry.
 *
 * Both are weak child rows of their show rather than library entity types: the
 * show owns them, seasons are addressed by their number, and episodes resolve
 * by external id first and by season/episode number second.
 */
export class ExtensionLibraryTvStore {
  constructor(private readonly options: ExtensionLibraryTvStoreOptions) {}

  listSeasons(query: LibraryTvSeasonQuery): readonly LibraryTvSeason[] {
    ensureNonEmptyString(query.tvId, 'library tv id')

    try {
      const conditions: SQL[] = [eq(tvSeasons.tvId, query.tvId)]
      if (query.includeSpecials === false) {
        conditions.push(ne(tvSeasons.seasonNumber, 0))
      }

      const rows = this.options.db.client
        .select()
        .from(tvSeasons)
        .where(and(...conditions))
        .orderBy(asc(tvSeasons.orderInTv), asc(tvSeasons.seasonNumber))
        .all()
      return rows.map(toSeasonDto)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list the tv seasons.')
    }
  }

  getSeason(seasonId: string): LibraryTvSeason | null {
    ensureNonEmptyString(seasonId, 'library tv season id')

    try {
      const row = this.options.db.client
        .select()
        .from(tvSeasons)
        .where(eq(tvSeasons.id, seasonId))
        .get()
      return row ? toSeasonDto(row) : null
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the tv season.')
    }
  }

  createSeason(tvId: string, input: LibraryTvSeasonCreateInput): LibraryTvSeason {
    ensureNonEmptyString(tvId, 'library tv id')

    try {
      const id = nanoid()
      this.options.db.client.transaction((tx) => {
        const owner = tx.select({ id: tvs.id }).from(tvs).where(eq(tvs.id, tvId)).get()
        if (!owner) {
          throw createNotFoundError(`Library tv "${tvId}" was not found.`)
        }

        tx.insert(tvSeasons)
          .values({
            id,
            tvId,
            seasonNumber: input.seasonNumber,
            name: input.name,
            originalName: input.originalName,
            airDate: input.airDate,
            description: input.description,
            totalEpisodes: input.totalEpisodes,
            orderInTv: input.order
          })
          .run()
      })

      return this.requireSeason(id)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the tv season.')
    }
  }

  /**
   * The create input doubles as the patch shape: seasons have no create-only
   * fields, and absent fields are skipped, so an update merges rather than
   * replaces.
   */
  updateSeason(seasonId: string, input: LibraryTvSeasonCreateInput): LibraryTvSeason {
    ensureNonEmptyString(seasonId, 'library tv season id')

    try {
      const values = stripUndefined({
        seasonNumber: input.seasonNumber,
        name: input.name,
        originalName: input.originalName,
        airDate: input.airDate,
        description: input.description,
        totalEpisodes: input.totalEpisodes,
        orderInTv: input.order
      })
      if (Object.keys(values).length > 0) {
        this.options.db.client.update(tvSeasons).set(values).where(eq(tvSeasons.id, seasonId)).run()
      }

      return this.requireSeason(seasonId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the tv season.')
    }
  }

  removeSeason(seasonId: string): void {
    ensureNonEmptyString(seasonId, 'library tv season id')

    try {
      this.options.db.client.delete(tvSeasons).where(eq(tvSeasons.id, seasonId)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the tv season.')
    }
  }

  /** Seasons are identified by their number within the show. */
  findSeasonMatch(tvId: string, seasonNumber: number): LibraryTvSeason | null {
    const row = this.options.db.client
      .select({ id: tvSeasons.id })
      .from(tvSeasons)
      .where(and(eq(tvSeasons.tvId, tvId), eq(tvSeasons.seasonNumber, seasonNumber)))
      .get()
    return row ? this.getSeason(row.id) : null
  }

  listEpisodes(query: LibraryTvEpisodeQuery): readonly LibraryTvEpisode[] {
    ensureNonEmptyString(query.tvId, 'library tv id')

    try {
      const conditions: SQL[] = [eq(tvEpisodes.tvId, query.tvId)]
      if (query.seasonNumbers?.length) {
        const seasonIds = this.options.db.client
          .select({ id: tvSeasons.id })
          .from(tvSeasons)
          .where(
            and(
              eq(tvSeasons.tvId, query.tvId),
              inArray(tvSeasons.seasonNumber, [...query.seasonNumbers])
            )
          )
          .all()
          .map((row) => row.id)
        if (seasonIds.length === 0) {
          return []
        }
        conditions.push(inArray(tvEpisodes.seasonId, seasonIds))
      }
      if (query.watchedOnly) {
        conditions.push(eq(tvEpisodes.watched, true))
      }
      if (query.unwatchedOnly) {
        conditions.push(eq(tvEpisodes.watched, false))
      }

      const rows = this.options.db.client
        .select()
        .from(tvEpisodes)
        .where(and(...conditions))
        .orderBy(asc(tvEpisodes.orderInTv), asc(tvEpisodes.createdAt))
        .all()

      const externalIds = loadExternalIds(
        this.options.db.client,
        TV_EPISODE_EXTERNAL_IDS_CONFIG,
        rows.map((row) => row.id)
      )
      return rows.map((row) => toEpisodeDto(row, externalIds.get(row.id) ?? []))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list the tv episodes.')
    }
  }

  getEpisode(episodeId: string): LibraryTvEpisode | null {
    ensureNonEmptyString(episodeId, 'library tv episode id')

    try {
      const row = this.options.db.client
        .select()
        .from(tvEpisodes)
        .where(eq(tvEpisodes.id, episodeId))
        .get()
      if (!row) {
        return null
      }

      const externalIds =
        loadExternalIds(this.options.db.client, TV_EPISODE_EXTERNAL_IDS_CONFIG, [episodeId]).get(
          episodeId
        ) ?? []
      return toEpisodeDto(row, externalIds)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the tv episode.')
    }
  }

  createEpisode(seasonId: string, input: LibraryTvEpisodeCreateInput): LibraryTvEpisode {
    ensureNonEmptyString(seasonId, 'library tv season id')

    try {
      const id = nanoid()
      this.options.db.client.transaction((tx) => {
        const season = tx
          .select({ id: tvSeasons.id, tvId: tvSeasons.tvId })
          .from(tvSeasons)
          .where(eq(tvSeasons.id, seasonId))
          .get()
        if (!season) {
          throw createNotFoundError(`Library tv season "${seasonId}" was not found.`)
        }

        tx.insert(tvEpisodes)
          .values({
            id,
            tvId: season.tvId,
            seasonId,
            episodeNumber: input.episodeNumber,
            name: input.name,
            originalName: input.originalName,
            airDate: input.airDate,
            description: input.description,
            durationMs: input.durationMs,
            orderInSeason: input.order,
            orderInTv: input.order
          })
          .run()
        syncExternalIds(tx, TV_EPISODE_EXTERNAL_IDS_CONFIG, id, input.externalIds)
      })

      return this.requireEpisode(id)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the tv episode.')
    }
  }

  /**
   * The create input doubles as the patch shape: episodes have no create-only
   * fields, and absent fields are skipped, so an update merges rather than
   * replaces.
   */
  updateEpisode(episodeId: string, input: LibraryTvEpisodeCreateInput): LibraryTvEpisode {
    ensureNonEmptyString(episodeId, 'library tv episode id')

    try {
      this.options.db.client.transaction((tx) => {
        const existing = tx
          .select({ id: tvEpisodes.id })
          .from(tvEpisodes)
          .where(eq(tvEpisodes.id, episodeId))
          .get()
        if (!existing) {
          throw createNotFoundError(`Library tv episode "${episodeId}" was not found.`)
        }

        const values = stripUndefined({
          episodeNumber: input.episodeNumber,
          name: input.name,
          originalName: input.originalName,
          airDate: input.airDate,
          description: input.description,
          durationMs: input.durationMs,
          orderInSeason: input.order,
          orderInTv: input.order
        })
        if (Object.keys(values).length > 0) {
          tx.update(tvEpisodes).set(values).where(eq(tvEpisodes.id, episodeId)).run()
        }

        if (input.externalIds) {
          syncExternalIds(tx, TV_EPISODE_EXTERNAL_IDS_CONFIG, episodeId, input.externalIds)
        }
      })

      return this.requireEpisode(episodeId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the tv episode.')
    }
  }

  /**
   * Patches one episode's watch state.
   *
   * Playback evidence never outlives the state it proves: clearing `watched`
   * drops the recorded time too, and asking for a time on an unwatched episode
   * is a contradiction rather than a state to store.
   */
  patchEpisodeWatchState(
    episodeId: string,
    patch: LibraryTvEpisodeWatchStatePatch
  ): LibraryTvEpisode {
    ensureNonEmptyString(episodeId, 'library tv episode id')

    try {
      const values = stripUndefined({
        watched: patch.watched,
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
        .select({
          id: tvEpisodes.id,
          watched: tvEpisodes.watched,
          watchedAt: tvEpisodes.watchedAt
        })
        .from(tvEpisodes)
        .where(eq(tvEpisodes.id, episodeId))
        .get()
      if (!existing) {
        throw createNotFoundError(`Library tv episode "${episodeId}" was not found.`)
      }

      const watched = patch.watched ?? existing.watched
      if (!watched) {
        if (values.watchedAt) {
          throw createValidationError(
            `Library tv episode "${episodeId}" cannot take a watch time while not watched.`
          )
        }
        if (existing.watchedAt !== null) {
          values.watchedAt = null
        }
      }

      if (Object.keys(values).length > 0) {
        this.options.db.client
          .update(tvEpisodes)
          .set(values)
          .where(eq(tvEpisodes.id, episodeId))
          .run()
      }

      return this.requireEpisode(episodeId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the tv episode watch state.')
    }
  }

  removeEpisode(episodeId: string): void {
    ensureNonEmptyString(episodeId, 'library tv episode id')

    try {
      this.options.db.client.delete(tvEpisodes).where(eq(tvEpisodes.id, episodeId)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the tv episode.')
    }
  }

  /** Resolves an incoming episode to an existing row: external id first, then number. */
  findEpisodeMatch(
    seasonId: string,
    input: Pick<LibraryTvEpisodeCreateInput, 'externalIds' | 'episodeNumber'>
  ): LibraryTvEpisode | null {
    for (const externalId of input.externalIds ?? []) {
      const row = this.options.db.client
        .select({ episodeId: tvEpisodeExternalIds.episodeId })
        .from(tvEpisodeExternalIds)
        .innerJoin(tvEpisodes, eq(tvEpisodes.id, tvEpisodeExternalIds.episodeId))
        .where(
          and(
            eq(tvEpisodes.seasonId, seasonId),
            eq(tvEpisodeExternalIds.source, externalId.source),
            eq(tvEpisodeExternalIds.externalId, externalId.id)
          )
        )
        .get()
      if (row) {
        return this.getEpisode(row.episodeId)
      }
    }

    if (input.episodeNumber === undefined || input.episodeNumber === null) {
      return null
    }

    const row = this.options.db.client
      .select({ id: tvEpisodes.id })
      .from(tvEpisodes)
      .where(
        and(eq(tvEpisodes.seasonId, seasonId), eq(tvEpisodes.episodeNumber, input.episodeNumber))
      )
      .get()
    return row ? this.getEpisode(row.id) : null
  }

  private requireSeason(seasonId: string): LibraryTvSeason {
    const season = this.getSeason(seasonId)
    if (!season) {
      throw createNotFoundError(`Library tv season "${seasonId}" was not found.`)
    }

    return season
  }

  private requireEpisode(episodeId: string): LibraryTvEpisode {
    const episode = this.getEpisode(episodeId)
    if (!episode) {
      throw createNotFoundError(`Library tv episode "${episodeId}" was not found.`)
    }

    return episode
  }
}

function toSeasonDto(row: typeof tvSeasons.$inferSelect): LibraryTvSeason {
  return {
    id: row.id,
    tvId: row.tvId,
    seasonNumber: row.seasonNumber,
    name: optionalValue(row.name),
    originalName: optionalValue(row.originalName),
    airDate: optionalValue(row.airDate),
    description: optionalValue(row.description),
    posterFile: optionalValue(row.posterFile),
    totalEpisodes: row.totalEpisodes,
    orderInTv: row.orderInTv,
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt)
  }
}

function toEpisodeDto(
  row: typeof tvEpisodes.$inferSelect,
  externalIds: readonly ExternalId[]
): LibraryTvEpisode {
  return {
    id: row.id,
    tvId: row.tvId,
    seasonId: row.seasonId,
    episodeNumber: row.episodeNumber,
    name: optionalValue(row.name),
    originalName: optionalValue(row.originalName),
    airDate: optionalValue(row.airDate),
    description: optionalValue(row.description),
    stillFile: optionalValue(row.stillFile),
    durationMs: row.durationMs,
    watched: row.watched,
    watchedAt: toNullableTimestampMs(row.watchedAt),
    playCount: row.playCount,
    resumePositionMs: row.resumePositionMs,
    orderInSeason: row.orderInSeason,
    orderInTv: row.orderInTv,
    externalIds,
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt)
  }
}

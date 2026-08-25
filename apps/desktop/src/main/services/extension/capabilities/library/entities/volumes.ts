import type {
  ExternalId,
  LibraryNovelVolume,
  LibraryNovelVolumeCreateInput,
  LibraryNovelVolumeQuery,
  LibraryNovelVolumeReadStatePatch
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  createValidationError,
  ensureNonEmptyString,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, asc, eq, type SQL } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { novelVolumeExternalIds, novelVolumes, novels } from '@shared/db'
import type { DbService } from '@main/services/db'
import { loadExternalIds, syncExternalIds } from './external-ids'
import type { ExternalIdConfig } from './types'
import { optionalValue, stripUndefined, toNullableTimestampMs, toTimestampMs } from './utils'

const VOLUME_EXTERNAL_IDS_CONFIG = {
  table: novelVolumeExternalIds,
  entityIdColumn: novelVolumeExternalIds.volumeId,
  sourceColumn: novelVolumeExternalIds.source,
  externalIdColumn: novelVolumeExternalIds.externalId,
  orderColumn: novelVolumeExternalIds.orderInVolume,
  toEntityId(row) {
    return row.volumeId
  },
  toExternalId(row) {
    return { source: row.source, id: row.externalId }
  },
  buildInsertValue(entityId, externalId, order) {
    return {
      volumeId: entityId,
      source: externalId.source,
      externalId: externalId.id,
      orderInVolume: order
    }
  }
} satisfies ExternalIdConfig<typeof novelVolumeExternalIds>

export interface ExtensionLibraryNovelVolumeStoreOptions {
  db: DbService
}

/**
 * Novel volumes are owned by their novel entry rather than being a library
 * entity type: every read and write is addressed through a novel id, and
 * identity is resolved by external id first, volume number second.
 */
export class ExtensionLibraryNovelVolumeStore {
  constructor(private readonly options: ExtensionLibraryNovelVolumeStoreOptions) {}

  list(query: LibraryNovelVolumeQuery): readonly LibraryNovelVolume[] {
    ensureNonEmptyString(query.novelId, 'library novel id')

    try {
      const conditions: SQL[] = [eq(novelVolumes.novelId, query.novelId)]
      if (query.readOnly) {
        conditions.push(eq(novelVolumes.read, true))
      }
      if (query.unreadOnly) {
        conditions.push(eq(novelVolumes.read, false))
      }

      const rows = this.options.db.client
        .select()
        .from(novelVolumes)
        .where(and(...conditions))
        .orderBy(asc(novelVolumes.orderInNovel), asc(novelVolumes.createdAt))
        .all()

      const externalIds = loadExternalIds(
        this.options.db.client,
        VOLUME_EXTERNAL_IDS_CONFIG,
        rows.map((row) => row.id)
      )
      return rows.map((row) => toVolumeDto(row, externalIds.get(row.id) ?? []))
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list the novel volumes.')
    }
  }

  get(volumeId: string): LibraryNovelVolume | null {
    ensureNonEmptyString(volumeId, 'library novel volume id')

    try {
      const row = this.options.db.client
        .select()
        .from(novelVolumes)
        .where(eq(novelVolumes.id, volumeId))
        .get()
      if (!row) {
        return null
      }

      const externalIds =
        loadExternalIds(this.options.db.client, VOLUME_EXTERNAL_IDS_CONFIG, [volumeId]).get(
          volumeId
        ) ?? []
      return toVolumeDto(row, externalIds)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to read the novel volume.')
    }
  }

  create(novelId: string, input: LibraryNovelVolumeCreateInput): LibraryNovelVolume {
    ensureNonEmptyString(novelId, 'library novel id')

    try {
      const id = nanoid()
      this.options.db.client.transaction((tx) => {
        const owner = tx.select({ id: novels.id }).from(novels).where(eq(novels.id, novelId)).get()
        if (!owner) {
          throw createNotFoundError(`Library novel "${novelId}" was not found.`)
        }

        tx.insert(novelVolumes)
          .values({
            id,
            novelId,
            volumeNumber: input.volumeNumber,
            name: input.name,
            originalName: input.originalName,
            releaseDate: input.releaseDate,
            description: input.description,
            orderInNovel: input.order
          })
          .run()
        syncExternalIds(tx, VOLUME_EXTERNAL_IDS_CONFIG, id, input.externalIds)
      })

      return this.require(id)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the novel volume.')
    }
  }

  /**
   * The create input doubles as the patch shape: volumes have no create-only
   * fields, and `stripUndefined` below skips every absent field, so an update
   * merges rather than replaces.
   */
  update(volumeId: string, input: LibraryNovelVolumeCreateInput): LibraryNovelVolume {
    ensureNonEmptyString(volumeId, 'library novel volume id')

    try {
      this.options.db.client.transaction((tx) => {
        const existing = tx
          .select({ id: novelVolumes.id })
          .from(novelVolumes)
          .where(eq(novelVolumes.id, volumeId))
          .get()
        if (!existing) {
          throw createNotFoundError(`Library novel volume "${volumeId}" was not found.`)
        }

        const values = stripUndefined({
          volumeNumber: input.volumeNumber,
          name: input.name,
          originalName: input.originalName,
          releaseDate: input.releaseDate,
          description: input.description,
          orderInNovel: input.order
        })
        if (Object.keys(values).length > 0) {
          tx.update(novelVolumes).set(values).where(eq(novelVolumes.id, volumeId)).run()
        }

        if (input.externalIds) {
          syncExternalIds(tx, VOLUME_EXTERNAL_IDS_CONFIG, volumeId, input.externalIds)
        }
      })

      return this.require(volumeId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the novel volume.')
    }
  }

  /**
   * Patches one volume's read state.
   *
   * Reading evidence never outlives the state it proves: clearing `read`
   * drops the recorded time too, and asking for a read time on an unread
   * volume is a contradiction rather than a state to store.
   */
  patchReadState(volumeId: string, patch: LibraryNovelVolumeReadStatePatch): LibraryNovelVolume {
    ensureNonEmptyString(volumeId, 'library novel volume id')

    try {
      const values = stripUndefined({
        read: patch.read,
        readAt:
          patch.readAt === undefined
            ? undefined
            : patch.readAt === null
              ? null
              : new Date(patch.readAt),
        readCount: patch.readCount,
        resumeLocator: patch.resumeLocator,
        resumeProgress: patch.resumeProgress
      })

      const existing = this.options.db.client
        .select({
          id: novelVolumes.id,
          read: novelVolumes.read,
          readAt: novelVolumes.readAt
        })
        .from(novelVolumes)
        .where(eq(novelVolumes.id, volumeId))
        .get()
      if (!existing) {
        throw createNotFoundError(`Library novel volume "${volumeId}" was not found.`)
      }

      const read = patch.read ?? existing.read
      if (!read) {
        if (values.readAt) {
          throw createValidationError(
            `Library novel volume "${volumeId}" cannot take a read time while not read.`
          )
        }
        if (existing.readAt !== null) {
          values.readAt = null
        }
      }

      if (Object.keys(values).length > 0) {
        this.options.db.client
          .update(novelVolumes)
          .set(values)
          .where(eq(novelVolumes.id, volumeId))
          .run()
      }

      return this.require(volumeId)
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the novel volume read state.')
    }
  }

  remove(volumeId: string): void {
    ensureNonEmptyString(volumeId, 'library novel volume id')

    try {
      this.options.db.client.delete(novelVolumes).where(eq(novelVolumes.id, volumeId)).run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the novel volume.')
    }
  }

  /** Resolves an incoming volume to an existing row: external id first, then number. */
  findMatch(
    novelId: string,
    input: Pick<LibraryNovelVolumeCreateInput, 'externalIds' | 'volumeNumber'>
  ): LibraryNovelVolume | null {
    for (const externalId of input.externalIds ?? []) {
      const row = this.options.db.client
        .select({ volumeId: novelVolumeExternalIds.volumeId })
        .from(novelVolumeExternalIds)
        .innerJoin(novelVolumes, eq(novelVolumes.id, novelVolumeExternalIds.volumeId))
        .where(
          and(
            eq(novelVolumes.novelId, novelId),
            eq(novelVolumeExternalIds.source, externalId.source),
            eq(novelVolumeExternalIds.externalId, externalId.id)
          )
        )
        .get()
      if (row) {
        return this.get(row.volumeId)
      }
    }

    if (input.volumeNumber === undefined || input.volumeNumber === null) {
      return null
    }

    const row = this.options.db.client
      .select({ id: novelVolumes.id })
      .from(novelVolumes)
      .where(
        and(eq(novelVolumes.novelId, novelId), eq(novelVolumes.volumeNumber, input.volumeNumber))
      )
      .get()
    return row ? this.get(row.id) : null
  }

  private require(volumeId: string): LibraryNovelVolume {
    const volume = this.get(volumeId)
    if (!volume) {
      throw createNotFoundError(`Library novel volume "${volumeId}" was not found.`)
    }

    return volume
  }
}

function toVolumeDto(
  row: typeof novelVolumes.$inferSelect,
  externalIds: readonly ExternalId[]
): LibraryNovelVolume {
  return {
    id: row.id,
    novelId: row.novelId,
    volumeNumber: row.volumeNumber,
    name: optionalValue(row.name),
    originalName: optionalValue(row.originalName),
    releaseDate: optionalValue(row.releaseDate),
    description: optionalValue(row.description),
    coverFile: optionalValue(row.coverFile),
    read: row.read,
    readAt: toNullableTimestampMs(row.readAt),
    readCount: row.readCount,
    resumeLocator: optionalValue(row.resumeLocator),
    resumeProgress: row.resumeProgress,
    orderInNovel: row.orderInNovel,
    externalIds,
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt)
  }
}

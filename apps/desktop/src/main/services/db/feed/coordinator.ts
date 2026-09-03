/**
 * Db change feed.
 *
 * Consumes raw trigger changes and fans them out through four explicit
 * outlets:
 * - batched `db:changed` IPC pushes for renderer cache invalidation,
 * - the `db.changed` hook carrying the same batches to main-process modules,
 * - the debounced, entity-grouped `library.changed` hook,
 * - immediate `app.settings.changed` hook dispatches from settings rows.
 */

import type Database from 'better-sqlite3'
import { createLogger } from '@main/log'
import { toDbChangeSummary, type DbChangeSummary, type RawDbChange } from '@shared/db/changes'
import type { LibraryEntityChangeSummary } from '@shared/library'
import type { DbHooks } from '../hooks'
import { deriveChangeTargets } from './attribution'
import {
  ENTITY_PROJECTIONS,
  getEntityProjectionForTopic,
  getMediaCreatedName,
  getMediaProjectionForTopic,
  mediaExists,
  projectEntityChanges,
  projectMediaChanges
} from './projections/registry'
import {
  FEED_DEBOUNCE_MS,
  FEED_PUSH_CHUNK_SIZE,
  type ConfiguredEntityTopic,
  type EntityGroup,
  type MediaFeedProjection
} from './types'
import { SETTINGS_PROJECTIONS, type SettingsColumnProjection } from './projections/settings'
import { stringValue } from './normalization'

const log = createLogger('Db')

export interface DbChangeFeedOptions {
  hooks: DbHooks
  /** Pushes batched change summaries to the renderer (`db:changed`). */
  sendToRenderer: (changes: DbChangeSummary[]) => void
  /** Row deletion callback for attachment storage cleanup. */
  onRowDeleted: (table: RawDbChange['table'], id: string) => void
}

export class DbChangeFeed {
  private readonly groups = new Map<string, EntityGroup>()
  private pendingSummaries: DbChangeSummary[] = []
  private flushTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly sqlite: Database.Database,
    private readonly options: DbChangeFeedOptions
  ) {}

  enqueue(change: RawDbChange): void {
    if (change.operation === 'deleted') {
      this.options.onRowDeleted(change.table, change.id)
    }

    this.dispatchSettingsChanged(change)
    this.pendingSummaries.push(toDbChangeSummary(change))

    for (const target of deriveChangeTargets(change)) {
      const key = `${target.entity}:${target.id}`
      const group = this.groups.get(key)
      if (group) {
        group.changes.push(change)
      } else {
        this.groups.set(key, { ...target, changes: [change] })
      }
    }

    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), FEED_DEBOUNCE_MS)
    }
  }

  dispose(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.groups.clear()
    this.pendingSummaries = []
  }

  /** Delivers buffered changes immediately instead of waiting out the debounce. */
  flush(): void {
    const groups = [...this.groups.values()]
    const summaries = this.pendingSummaries
    this.groups.clear()
    this.pendingSummaries = []
    this.flushTimer = null

    for (let start = 0; start < summaries.length; start += FEED_PUSH_CHUNK_SIZE) {
      const chunk = summaries.slice(start, start + FEED_PUSH_CHUNK_SIZE)
      this.options.sendToRenderer(chunk)
      this.options.hooks.dbChanged.dispatch({ changes: chunk })
    }

    const changes: LibraryEntityChangeSummary[] = []
    for (const group of groups) {
      try {
        const mediaProjection = getMediaProjectionForTopic(group.entity)
        const summary = mediaProjection
          ? this.projectMediaGroup(mediaProjection, group.id, group.changes)
          : this.projectEntityGroup(group.entity as ConfiguredEntityTopic, group.id, group.changes)
        if (summary) {
          changes.push(summary)
        }
      } catch (error) {
        log.error('Failed to project.', error, { groupEntity: group.entity, groupId: group.id })
      }
    }

    if (changes.length > 0) {
      this.options.hooks.libraryChanged.dispatch({ changes })
    }
  }

  private dispatchSettingsChanged(change: RawDbChange): void {
    if (
      change.table !== 'settings' ||
      change.operation !== 'updated' ||
      !change.old ||
      !change.next
    ) {
      return
    }

    for (const projection of SETTINGS_PROJECTIONS) {
      const oldValue = projectSettingValue(projection, change.old[projection.column])
      const nextValue = projectSettingValue(projection, change.next[projection.column])
      if (settingValuesEqual(oldValue, nextValue)) {
        continue
      }

      this.options.hooks.settingsChanged.dispatch({ setting: projection.setting, value: nextValue })
    }
  }

  private projectMediaGroup(
    projection: MediaFeedProjection,
    mediaId: string,
    changes: RawDbChange[]
  ): LibraryEntityChangeSummary | null {
    const directChanges = changes.filter((change) => change.table === projection.table)
    const created = directChanges.some((change) => change.operation === 'inserted')
    const deleted = directChanges.some((change) => change.operation === 'deleted')
    const occurredAt = Math.max(...changes.map((change) => change.occurredAt))
    const actors = collectActors(changes)

    if (deleted) {
      return { entity: projection.entity, id: mediaId, kind: 'deleted', occurredAt, actors }
    }

    if (created) {
      const next = directChanges.findLast((change) => change.next)?.next
      return {
        entity: projection.entity,
        id: mediaId,
        kind: 'created',
        name: getMediaCreatedName(this.sqlite, projection, mediaId, next),
        occurredAt,
        actors
      }
    }

    if (!mediaExists(this.sqlite, projection, mediaId)) {
      return null
    }

    const projectedChanges = projectMediaChanges(this.sqlite, projection, mediaId, changes)
    if (projectedChanges.length === 0) {
      return null
    }

    return {
      entity: projection.entity,
      id: mediaId,
      kind: 'updated',
      changes: projectedChanges,
      occurredAt,
      actors
    }
  }

  private projectEntityGroup(
    entity: ConfiguredEntityTopic,
    entityId: string,
    changes: RawDbChange[]
  ): LibraryEntityChangeSummary | null {
    const projection = getEntityProjectionForTopic(entity)
    if (!projection) {
      return null
    }

    const tableChanges = changes.filter(
      (change) => ENTITY_PROJECTIONS[change.table]?.entity === entity
    )
    if (tableChanges.length === 0) {
      return null
    }

    const occurredAt = Math.max(...tableChanges.map((change) => change.occurredAt))
    const created = tableChanges.some((change) => change.operation === 'inserted')
    const deleted = tableChanges.some((change) => change.operation === 'deleted')
    const actors = collectActors(tableChanges)

    if (deleted) {
      return { entity, id: entityId, kind: 'deleted', occurredAt, actors }
    }

    if (created) {
      const next = tableChanges.findLast((change) => change.next)?.next
      return {
        entity,
        id: entityId,
        kind: 'created',
        name: stringValue(next?.name),
        occurredAt,
        actors
      }
    }

    const firstOld = tableChanges.find((change) => change.old)?.old
    const lastNext = tableChanges.findLast((change) => change.next)?.next
    if (!firstOld || !lastNext) {
      return null
    }

    const entityChanges = projectEntityChanges(projection, firstOld, lastNext)
    if (entityChanges.length === 0) {
      return null
    }

    return { entity, id: entityId, kind: 'updated', changes: entityChanges, occurredAt, actors }
  }
}

function collectActors(changes: RawDbChange[]): readonly string[] {
  return [...new Set(changes.map((change) => change.actor))].sort()
}

function projectSettingValue(projection: SettingsColumnProjection, value: unknown): unknown {
  if (value === undefined || value === null) {
    return value
  }

  return projection.fromDriver(value)
}

function settingValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (typeof left === 'object' || typeof right === 'object') {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  return false
}

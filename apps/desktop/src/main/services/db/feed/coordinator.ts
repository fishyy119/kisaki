/**
 * Db change feed.
 *
 * Consumes raw trigger changes and fans them out through three explicit
 * outlets:
 * - batched `db:changed` IPC pushes for renderer cache invalidation,
 * - the debounced, entity-grouped `library.changed` hook,
 * - immediate `app.settings.changed` hook dispatches from settings rows.
 */

import type Database from 'better-sqlite3'
import { createLogger } from '@main/log'
import type { DbChangeSummary, RawDbChange } from '@shared/db/changes'
import { toDbChangeSummary } from '@shared/db/changes'
import type { LibraryEntityChangeSummary } from '@shared/library'
import type { DbHooks } from '../hooks'
import {
  ENTITY_PROJECTIONS,
  gameExists,
  getEntityProjectionForTopic,
  getGameCreatedName,
  getGameIdsFromChange,
  projectEntityChanges,
  projectGameChanges
} from './entities'
import { FEED_DEBOUNCE_MS, type ConfiguredEntityTopic, type EntityGroup } from './types'
import { stringValue } from './shared/normalization'
import { dedupeTargets } from './shared/targets'

const log = createLogger('Db')
const SETTINGS_COLUMN_KEYS: Record<string, string> = {
  ui_locale: 'uiLocale',
  main_window_close_action: 'mainWindowCloseAction',
  scanner_ignored_names: 'scannerIgnoredNames',
  scanner_start_at_open: 'scannerStartAtOpen',
  scanner_parallel_count: 'scannerParallelCount',
  scanner_ingest_mode: 'scannerIngestMode',
  updater_auto_check: 'updaterAutoCheck',
  updater_allow_prerelease: 'updaterAllowPrerelease'
}
const BOOLEAN_SETTINGS = new Set([
  'scanner_start_at_open',
  'updater_auto_check',
  'updater_allow_prerelease'
])
const JSON_SETTINGS = new Set(['scanner_ignored_names'])

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

    const targets = this.getTargets(change)
    for (const target of targets) {
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

  private flush(): void {
    const groups = [...this.groups.values()]
    const summaries = this.pendingSummaries
    this.groups.clear()
    this.pendingSummaries = []
    this.flushTimer = null

    if (summaries.length > 0) {
      this.options.sendToRenderer(summaries)
    }

    const changes: LibraryEntityChangeSummary[] = []
    for (const group of groups) {
      try {
        const summary =
          group.entity === 'game'
            ? this.projectGameGroup(group.id, group.changes)
            : this.projectEntityGroup(group.entity, group.id, group.changes)
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

  private getTargets(change: RawDbChange): Array<{ entity: EntityGroup['entity']; id: string }> {
    const targets: Array<{ entity: EntityGroup['entity']; id: string }> = []

    if (change.table === 'games') {
      targets.push({ entity: 'game', id: change.id })
    }

    const gameIds = getGameIdsFromChange(change)
    for (const gameId of gameIds) {
      targets.push({ entity: 'game', id: gameId })
    }

    const entityProjection = ENTITY_PROJECTIONS[change.table]
    if (entityProjection) {
      targets.push({ entity: entityProjection.entity, id: change.id })
    }

    return dedupeTargets(targets)
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

    for (const [column, setting] of Object.entries(SETTINGS_COLUMN_KEYS)) {
      const oldValue = normalizeSettingValue(column, change.old[column])
      const nextValue = normalizeSettingValue(column, change.next[column])
      if (settingValuesEqual(oldValue, nextValue)) {
        continue
      }

      this.options.hooks.settingsChanged.dispatch({ setting, value: nextValue })
    }
  }

  private projectGameGroup(
    gameId: string,
    changes: RawDbChange[]
  ): LibraryEntityChangeSummary | null {
    const directGameChanges = changes.filter((change) => change.table === 'games')
    const created = directGameChanges.some((change) => change.operation === 'inserted')
    const deleted = directGameChanges.some((change) => change.operation === 'deleted')
    const occurredAt = Math.max(...changes.map((change) => change.occurredAt))

    if (deleted) {
      return { entity: 'game', id: gameId, kind: 'deleted', occurredAt }
    }

    if (created) {
      const next = directGameChanges.findLast((change) => change.next)?.next
      return {
        entity: 'game',
        id: gameId,
        kind: 'created',
        name: getGameCreatedName(this.sqlite, gameId, next),
        occurredAt
      }
    }

    if (!gameExists(this.sqlite, gameId)) {
      return null
    }

    const projectedChanges = projectGameChanges(this.sqlite, gameId, changes)
    if (projectedChanges.length === 0) {
      return null
    }

    return {
      entity: 'game',
      id: gameId,
      kind: 'updated',
      changes: projectedChanges,
      occurredAt
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

    if (deleted) {
      return { entity, id: entityId, kind: 'deleted', occurredAt }
    }

    if (created) {
      const next = tableChanges.findLast((change) => change.next)?.next
      return {
        entity,
        id: entityId,
        kind: 'created',
        name: stringValue(next?.name),
        occurredAt
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

    return { entity, id: entityId, kind: 'updated', changes: entityChanges, occurredAt }
  }
}

function normalizeSettingValue(column: string, value: unknown): unknown {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  if (BOOLEAN_SETTINGS.has(column)) {
    return value === true || value === 1 || value === '1'
  }

  if (JSON_SETTINGS.has(column) && typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  return value
}

function settingValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right)
  }

  return false
}

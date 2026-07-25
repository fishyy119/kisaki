import type Database from 'better-sqlite3'
import { createLogger } from '@main/log'
import type { EventService } from '@main/services/event'
import type { AppEvents, EventUnsubscribe } from '@shared/events'
import type { LibraryEntityChange, RawDbChangeEvent, ScannerChange } from '@shared/events/library'
import {
  ENTITY_PROJECTIONS,
  gameExists,
  getEntityProjectionForTopic,
  getGameCreatedName,
  getGameIdsFromChange,
  projectEntityChanges,
  projectGameChanges
} from './entities'
import { PROJECTOR_DEBOUNCE_MS, type ConfiguredEntityTopic, type EntityGroup } from './types'
import { stringValue } from './shared/normalization'
import { dedupeTargets } from './shared/targets'

const log = createLogger('Db')
const SETTINGS_COLUMN_KEYS: Record<string, string> = {
  ui_locale: 'uiLocale',
  main_window_close_action: 'mainWindowCloseAction',
  scanner_ignored_names: 'scannerIgnoredNames',
  scanner_use_phash: 'scannerUsePhash',
  scanner_start_at_open: 'scannerStartAtOpen',
  scanner_parallel_count: 'scannerParallelCount',
  scanner_ingest_mode: 'scannerIngestMode',
  updater_auto_check: 'updaterAutoCheck',
  updater_allow_prerelease: 'updaterAllowPrerelease'
}
const BOOLEAN_SETTINGS = new Set([
  'scanner_use_phash',
  'scanner_start_at_open',
  'updater_auto_check',
  'updater_allow_prerelease'
])
const JSON_SETTINGS = new Set(['scanner_ignored_names'])

export class DbEventProjector {
  private readonly groups = new Map<string, EntityGroup>()
  private flushTimer: NodeJS.Timeout | null = null
  private readonly unsubscribes: EventUnsubscribe[] = []

  constructor(
    private readonly sqlite: Database.Database,
    private readonly event: EventService
  ) {}

  init(): void {
    this.unsubscribes.push(
      this.event.bus.on('db.inserted', (change) => this.enqueue(change)),
      this.event.bus.on('db.updated', (change) => this.enqueue(change)),
      this.event.bus.on('db.deleted', (change) => this.enqueue(change))
    )
    log.info('Initialized')
  }

  dispose(): void {
    for (const unsubscribe of this.unsubscribes.splice(0)) {
      unsubscribe()
    }
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
    this.groups.clear()
  }

  private enqueue(change: RawDbChangeEvent): void {
    this.emitSettingsChanged(change)

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

    if (!this.flushTimer && targets.length > 0) {
      this.flushTimer = setTimeout(() => this.flush(), PROJECTOR_DEBOUNCE_MS)
    }
  }

  private flush(): void {
    const groups = [...this.groups.values()]
    this.groups.clear()
    this.flushTimer = null

    for (const group of groups) {
      try {
        if (group.entity === 'game') {
          this.emitGameEvent(group.id, group.changes)
        } else {
          this.emitEntityEvent(group.entity, group.id, group.changes)
        }
      } catch (error) {
        log.error('Failed to project.', error, { groupEntity: group.entity, groupId: group.id })
      }
    }
  }

  private getTargets(
    change: RawDbChangeEvent
  ): Array<{ entity: EntityGroup['entity']; id: string }> {
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

  private emitSettingsChanged(change: RawDbChangeEvent): void {
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

      this.event.bus.emit('app.settings.changed', { setting, value: nextValue })
    }
  }

  private emitGameEvent(gameId: string, changes: RawDbChangeEvent[]): void {
    const directGameChanges = changes.filter((change) => change.table === 'games')
    const created = directGameChanges.some((change) => change.operation === 'inserted')
    const deleted = directGameChanges.some((change) => change.operation === 'deleted')
    const occurredAt = Math.max(...changes.map((change) => change.occurredAt))

    if (deleted) {
      this.event.bus.emit('game.deleted', {
        gameId,
        occurredAt
      })
      return
    }

    if (created) {
      const next = directGameChanges.findLast((change) => change.next)?.next
      this.event.bus.emit('game.created', {
        gameId,
        name: getGameCreatedName(this.sqlite, gameId, next),
        occurredAt
      })
      return
    }

    if (!gameExists(this.sqlite, gameId)) {
      return
    }

    const projectedChanges = projectGameChanges(this.sqlite, gameId, changes)
    if (projectedChanges.length === 0) {
      return
    }

    this.event.bus.emit('game.updated', {
      gameId,
      changes: projectedChanges,
      occurredAt
    })
  }

  private emitEntityEvent(
    entity: ConfiguredEntityTopic,
    entityId: string,
    changes: RawDbChangeEvent[]
  ): void {
    const projection = getEntityProjectionForTopic(entity)
    if (!projection) {
      return
    }

    const tableChanges = changes.filter(
      (change) => ENTITY_PROJECTIONS[change.table]?.entity === entity
    )
    if (tableChanges.length === 0) {
      return
    }

    const occurredAt = Math.max(...tableChanges.map((change) => change.occurredAt))
    const created = tableChanges.some((change) => change.operation === 'inserted')
    const deleted = tableChanges.some((change) => change.operation === 'deleted')

    if (deleted) {
      this.emitEntityLifecycleEvent(entity, 'deleted', entityId, occurredAt)
      return
    }

    if (created) {
      const next = tableChanges.findLast((change) => change.next)?.next
      this.emitEntityLifecycleEvent(
        entity,
        'created',
        entityId,
        occurredAt,
        stringValue(next?.name)
      )
      return
    }

    const firstOld = tableChanges.find((change) => change.old)?.old
    const lastNext = tableChanges.findLast((change) => change.next)?.next
    if (!firstOld || !lastNext) {
      return
    }

    const entityChanges = projectEntityChanges(projection, firstOld, lastNext)
    if (entityChanges.length === 0) {
      return
    }

    this.emitEntityUpdatedEvent(entity, entityId, entityChanges, occurredAt)
  }

  private emitEntityLifecycleEvent(
    entity: ConfiguredEntityTopic,
    kind: 'created' | 'deleted',
    entityId: string,
    occurredAt: number,
    name?: string
  ): void {
    if (kind === 'created') {
      switch (entity) {
        case 'person':
          this.event.bus.emit('person.created', { personId: entityId, name, occurredAt })
          return
        case 'company':
          this.event.bus.emit('company.created', { companyId: entityId, name, occurredAt })
          return
        case 'character':
          this.event.bus.emit('character.created', {
            characterId: entityId,
            name,
            occurredAt
          })
          return
        case 'collection':
          this.event.bus.emit('collection.created', {
            collectionId: entityId,
            name,
            occurredAt
          })
          return
        case 'tag':
          this.event.bus.emit('tag.created', { tagId: entityId, name, occurredAt })
          return
        case 'scanner':
          this.event.bus.emit('scanner.created', { scannerId: entityId, name, occurredAt })
          return
      }
    }

    switch (entity) {
      case 'person':
        this.event.bus.emit('person.deleted', { personId: entityId, occurredAt })
        return
      case 'company':
        this.event.bus.emit('company.deleted', { companyId: entityId, occurredAt })
        return
      case 'character':
        this.event.bus.emit('character.deleted', { characterId: entityId, occurredAt })
        return
      case 'collection':
        this.event.bus.emit('collection.deleted', { collectionId: entityId, occurredAt })
        return
      case 'tag':
        this.event.bus.emit('tag.deleted', { tagId: entityId, occurredAt })
        return
      case 'scanner':
        this.event.bus.emit('scanner.deleted', { scannerId: entityId, occurredAt })
        return
    }
  }

  private emitEntityUpdatedEvent(
    entity: ConfiguredEntityTopic,
    entityId: string,
    changes: Array<LibraryEntityChange | ScannerChange>,
    occurredAt: number
  ): void {
    switch (entity) {
      case 'person':
        this.event.bus.emit('person.updated', {
          personId: entityId,
          changes: changes as AppEvents['person.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'company':
        this.event.bus.emit('company.updated', {
          companyId: entityId,
          changes: changes as AppEvents['company.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'character':
        this.event.bus.emit('character.updated', {
          characterId: entityId,
          changes: changes as AppEvents['character.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'collection':
        this.event.bus.emit('collection.updated', {
          collectionId: entityId,
          changes: changes as AppEvents['collection.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'tag':
        this.event.bus.emit('tag.updated', {
          tagId: entityId,
          changes: changes as AppEvents['tag.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'scanner':
        this.event.bus.emit('scanner.updated', {
          scannerId: entityId,
          changes: changes as AppEvents['scanner.updated'][0]['changes'],
          occurredAt
        })
        return
    }
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

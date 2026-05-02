import type Database from 'better-sqlite3'
import log from 'electron-log/main'
import type { EventService } from '@main/services/event'
import type { AppEvents, EventUnsubscribe } from '@shared/events'
import type { LibraryEntityChange, RawDbChangeEvent } from '@shared/events/library'
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
import { dedupeTargets, stringValue } from './utils'

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
      this.event.on('db:inserted', (change) => this.enqueue(change)),
      this.event.on('db:updated', (change) => this.enqueue(change)),
      this.event.on('db:deleted', (change) => this.enqueue(change))
    )
    log.info('[DbEventProjector] Initialized')
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
        log.error(`[DbEventProjector] Failed to project ${group.entity}:${group.id}:`, error)
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

  private emitGameEvent(gameId: string, changes: RawDbChangeEvent[]): void {
    const directGameChanges = changes.filter((change) => change.table === 'games')
    const created = directGameChanges.some((change) => change.operation === 'inserted')
    const deleted = directGameChanges.some((change) => change.operation === 'deleted')
    const occurredAt = Math.max(...changes.map((change) => change.occurredAt))

    if (deleted) {
      this.event.emit('library.game.deleted', {
        gameId,
        occurredAt
      })
      return
    }

    if (created) {
      const next = directGameChanges.findLast((change) => change.next)?.next
      this.event.emit('library.game.created', {
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

    this.event.emit('library.game.updated', {
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
          this.event.emit('library.person.created', { personId: entityId, name, occurredAt })
          return
        case 'company':
          this.event.emit('library.company.created', { companyId: entityId, name, occurredAt })
          return
        case 'character':
          this.event.emit('library.character.created', { characterId: entityId, name, occurredAt })
          return
        case 'collection':
          this.event.emit('library.collection.created', {
            collectionId: entityId,
            name,
            occurredAt
          })
          return
        case 'tag':
          this.event.emit('library.tag.created', { tagId: entityId, name, occurredAt })
          return
      }
    }

    switch (entity) {
      case 'person':
        this.event.emit('library.person.deleted', { personId: entityId, occurredAt })
        return
      case 'company':
        this.event.emit('library.company.deleted', { companyId: entityId, occurredAt })
        return
      case 'character':
        this.event.emit('library.character.deleted', { characterId: entityId, occurredAt })
        return
      case 'collection':
        this.event.emit('library.collection.deleted', { collectionId: entityId, occurredAt })
        return
      case 'tag':
        this.event.emit('library.tag.deleted', { tagId: entityId, occurredAt })
        return
    }
  }

  private emitEntityUpdatedEvent(
    entity: ConfiguredEntityTopic,
    entityId: string,
    changes: LibraryEntityChange[],
    occurredAt: number
  ): void {
    switch (entity) {
      case 'person':
        this.event.emit('library.person.updated', {
          personId: entityId,
          changes: changes as AppEvents['library.person.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'company':
        this.event.emit('library.company.updated', {
          companyId: entityId,
          changes: changes as AppEvents['library.company.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'character':
        this.event.emit('library.character.updated', {
          characterId: entityId,
          changes: changes as AppEvents['library.character.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'collection':
        this.event.emit('library.collection.updated', {
          collectionId: entityId,
          changes: changes as AppEvents['library.collection.updated'][0]['changes'],
          occurredAt
        })
        return
      case 'tag':
        this.event.emit('library.tag.updated', {
          tagId: entityId,
          changes: changes as AppEvents['library.tag.updated'][0]['changes'],
          occurredAt
        })
        return
    }
  }
}

import type { HostEventTopic, HostEvents, SerializableValue } from '@kisaki3/extension-api'
import { createValidationError, normalizeCapabilityError } from '@kisaki3/extension-api'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import type { AppEvents } from '@shared/events'
import type { ExtensionHostRpcClient } from '../runtime'

type EventUnsubscribe = () => void

interface HostEventSubscriptionRecord {
  topic: HostEventTopic
  unsubscribe: EventUnsubscribe
}

export interface ExtensionEventsCapabilityProviderOptions {
  db: DbService
  event: EventService
}

export class ExtensionEventsCapabilityProvider {
  private readonly subscriptions = new Map<string, Map<string, HostEventSubscriptionRecord>>()
  private rpc: ExtensionHostRpcClient | null = null

  constructor(private readonly options: ExtensionEventsCapabilityProviderOptions) {}

  attachRpc(rpc: ExtensionHostRpcClient): void {
    this.rpc = rpc
  }

  detachRpc(): void {
    this.rpc = null
  }

  subscribeHost(runtimeHandle: string, subscriptionId: string, topic: HostEventTopic): void {
    try {
      const unsubscribe = this.createHostSubscription(topic, subscriptionId)
      let scopedSubscriptions = this.subscriptions.get(runtimeHandle)
      if (!scopedSubscriptions) {
        scopedSubscriptions = new Map()
        this.subscriptions.set(runtimeHandle, scopedSubscriptions)
      }

      const existing = scopedSubscriptions.get(subscriptionId)
      existing?.unsubscribe()
      scopedSubscriptions.set(subscriptionId, { topic, unsubscribe })
    } catch (error) {
      throw normalizeCapabilityError(error, `Failed to subscribe to host event "${topic}".`)
    }
  }

  unsubscribeHost(runtimeHandle: string, subscriptionId: string): void {
    const scopedSubscriptions = this.subscriptions.get(runtimeHandle)
    const record = scopedSubscriptions?.get(subscriptionId)
    if (!record) {
      return
    }

    record.unsubscribe()
    scopedSubscriptions!.delete(subscriptionId)
    if (scopedSubscriptions!.size === 0) {
      this.subscriptions.delete(runtimeHandle)
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    const scopedSubscriptions = this.subscriptions.get(runtimeHandle)
    if (!scopedSubscriptions) {
      return
    }

    for (const record of scopedSubscriptions.values()) {
      record.unsubscribe()
    }

    this.subscriptions.delete(runtimeHandle)
  }

  releaseAll(): void {
    for (const runtimeHandle of [...this.subscriptions.keys()]) {
      this.releaseRuntime(runtimeHandle)
    }
  }

  private createHostSubscription(topic: HostEventTopic, subscriptionId: string): EventUnsubscribe {
    switch (topic) {
      case 'app.ready':
        return this.options.event.bus.on('app.ready', () => {
          this.emitSubscriptionEvent(subscriptionId, topic, {})
        })
      case 'extension.enabled':
        return this.options.event.bus.on('extension.enabled', ({ extensionId }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { extensionId })
        })
      case 'extension.disabled':
        return this.options.event.bus.on('extension.disabled', ({ extensionId }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { extensionId })
        })
      case 'app.locale.changed':
        return this.options.event.bus.on('app.locale.changed', ({ locale }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { locale })
        })
      case 'app.settings.changed':
        return this.options.event.bus.on('app.settings.changed', ({ setting, value }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            key: setting,
            value: toSerializableValue(value)
          })
        })
      case 'app.theme.changed':
        return this.options.event.bus.on('app.theme.changed', ({ theme }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            themeId: 'active',
            mode: theme
          })
        })
      case 'game.created':
        return this.options.event.bus.on('game.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostGameCreatedEvent(event))
        })
      case 'game.updated':
        return this.options.event.bus.on('game.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostGameUpdatedEvent(event))
        })
      case 'game.deleted':
        return this.options.event.bus.on('game.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostGameDeletedEvent(event))
        })
      case 'game.started':
        return this.options.event.bus.on('game.started', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      case 'game.stopped':
        return this.options.event.bus.on('game.stopped', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      case 'person.created':
        return this.options.event.bus.on('person.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostPersonCreatedEvent(event))
        })
      case 'person.updated':
        return this.options.event.bus.on('person.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostPersonUpdatedEvent(event))
        })
      case 'person.deleted':
        return this.options.event.bus.on('person.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostPersonDeletedEvent(event))
        })
      case 'character.created':
        return this.options.event.bus.on('character.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: event.characterId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'character.updated':
        return this.options.event.bus.on('character.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: event.characterId,
            changes: cloneHostValue(event.changes),
            occurredAt: event.occurredAt
          })
        })
      case 'character.deleted':
        return this.options.event.bus.on('character.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: event.characterId,
            occurredAt: event.occurredAt
          })
        })
      case 'company.created':
        return this.options.event.bus.on('company.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: event.companyId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'company.updated':
        return this.options.event.bus.on('company.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: event.companyId,
            changes: cloneHostValue(event.changes),
            occurredAt: event.occurredAt
          })
        })
      case 'company.deleted':
        return this.options.event.bus.on('company.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: event.companyId,
            occurredAt: event.occurredAt
          })
        })
      case 'collection.created':
        return this.options.event.bus.on('collection.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: event.collectionId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'collection.updated':
        return this.options.event.bus.on('collection.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: event.collectionId,
            changes: cloneHostValue(event.changes) as HostEvents['collection.updated']['changes'],
            occurredAt: event.occurredAt
          })
        })
      case 'collection.deleted':
        return this.options.event.bus.on('collection.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: event.collectionId,
            occurredAt: event.occurredAt
          })
        })
      case 'tag.created':
        return this.options.event.bus.on('tag.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: event.tagId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'tag.updated':
        return this.options.event.bus.on('tag.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: event.tagId,
            changes: cloneHostValue(event.changes),
            occurredAt: event.occurredAt
          })
        })
      case 'tag.deleted':
        return this.options.event.bus.on('tag.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: event.tagId,
            occurredAt: event.occurredAt
          })
        })
      case 'scanner.created':
        return this.options.event.bus.on('scanner.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      case 'scanner.updated':
        return this.options.event.bus.on('scanner.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      case 'scanner.deleted':
        return this.options.event.bus.on('scanner.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      case 'command.started':
        return this.options.event.bus.on('command.started', (started) => {
          this.emitSubscriptionEvent(
            subscriptionId,
            topic,
            cloneHostValue(started) as HostEvents['command.started']
          )
        })
      case 'command.progressed':
        return this.options.event.bus.on('command.progressed', (progress) => {
          this.emitSubscriptionEvent(
            subscriptionId,
            topic,
            cloneHostValue(progress) as HostEvents['command.progressed']
          )
        })
      case 'command.finished':
        return this.options.event.bus.on('command.finished', (result) => {
          this.emitSubscriptionEvent(
            subscriptionId,
            topic,
            cloneHostValue(result) as HostEvents['command.finished']
          )
        })
      case 'scanner.started':
        return this.options.event.bus.on('scanner.started', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      case 'scanner.finished':
        return this.options.event.bus.on('scanner.finished', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, cloneHostValue(event))
        })
      default:
        throw createValidationError(`Unsupported host event topic "${topic}".`)
    }
  }

  private emitSubscriptionEvent<K extends HostEventTopic>(
    subscriptionId: string,
    topic: K,
    payload: HostEvents[K]
  ): void {
    if (!this.rpc) {
      return
    }

    this.rpc.sendEventToHost('capabilities.events.host', {
      subscriptionId,
      topic,
      payload
    })
  }
}

function toSerializableValue(value: unknown): SerializableValue | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }

  if (Array.isArray(value)) {
    const normalized: SerializableValue[] = []
    for (const entry of value) {
      const serialized = toSerializableValue(entry)
      if (serialized === undefined) {
        return JSON.stringify(value)
      }
      normalized.push(serialized)
    }
    return normalized
  }

  if (value && typeof value === 'object') {
    const record: Record<string, SerializableValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      const serialized = toSerializableValue(entry)
      if (serialized !== undefined) {
        record[key] = serialized
      }
    }
    return record
  }

  return String(value)
}

function toHostGameCreatedEvent(event: AppEvents['game.created'][0]): HostEvents['game.created'] {
  return {
    gameId: event.gameId,
    name: event.name,
    occurredAt: event.occurredAt
  }
}

function toHostGameUpdatedEvent(event: AppEvents['game.updated'][0]): HostEvents['game.updated'] {
  return {
    gameId: event.gameId,
    changes: cloneHostValue(event.changes),
    occurredAt: event.occurredAt
  }
}

function toHostGameDeletedEvent(event: AppEvents['game.deleted'][0]): HostEvents['game.deleted'] {
  return {
    gameId: event.gameId,
    occurredAt: event.occurredAt
  }
}

function toHostPersonCreatedEvent(
  event: AppEvents['person.created'][0]
): HostEvents['person.created'] {
  return {
    personId: event.personId,
    name: event.name,
    occurredAt: event.occurredAt
  }
}

function toHostPersonUpdatedEvent(
  event: AppEvents['person.updated'][0]
): HostEvents['person.updated'] {
  return {
    personId: event.personId,
    changes: cloneHostValue(event.changes),
    occurredAt: event.occurredAt
  }
}

function toHostPersonDeletedEvent(
  event: AppEvents['person.deleted'][0]
): HostEvents['person.deleted'] {
  return {
    personId: event.personId,
    occurredAt: event.occurredAt
  }
}

function cloneHostValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

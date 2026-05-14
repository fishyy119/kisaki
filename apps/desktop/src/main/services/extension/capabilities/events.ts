import type { HostEventTopic, HostEvents, SerializableValue } from '@kisaki/extension-api'
import { createValidationError, normalizeCapabilityError } from '@kisaki/extension-api'
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
        return this.options.event.on('app:ready', () => {
          this.emitSubscriptionEvent(subscriptionId, topic, {})
        })
      case 'extension.enabled':
        return this.options.event.on('extension:enabled', ({ extensionId }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { extensionId })
        })
      case 'extension.disabled':
        return this.options.event.on('extension:disabled', ({ extensionId }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { extensionId })
        })
      case 'app.locale.changed':
        return this.options.event.on('app:locale-changed', ({ locale }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { locale })
        })
      case 'app.settings.changed':
        return this.options.event.on('app:settings-changed', ({ setting, value }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            key: setting,
            value: toSerializableValue(value)
          })
        })
      case 'theme.changed':
        return this.options.event.on('app:theme-changed', ({ theme }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            themeId: 'active',
            mode: theme
          })
        })
      case 'library.game.created':
        return this.options.event.on('library.game.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostLibraryGameCreatedEvent(event))
        })
      case 'library.game.updated':
        return this.options.event.on('library.game.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostLibraryGameUpdatedEvent(event))
        })
      case 'library.game.deleted':
        return this.options.event.on('library.game.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostLibraryGameDeletedEvent(event))
        })
      case 'library.person.created':
        return this.options.event.on('library.person.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostLibraryPersonCreatedEvent(event))
        })
      case 'library.person.updated':
        return this.options.event.on('library.person.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostLibraryPersonUpdatedEvent(event))
        })
      case 'library.person.deleted':
        return this.options.event.on('library.person.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, toHostLibraryPersonDeletedEvent(event))
        })
      case 'library.character.created':
        return this.options.event.on('library.character.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: event.characterId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'library.character.updated':
        return this.options.event.on('library.character.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: event.characterId,
            changes: cloneHostValue(event.changes),
            occurredAt: event.occurredAt
          })
        })
      case 'library.character.deleted':
        return this.options.event.on('library.character.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: event.characterId,
            occurredAt: event.occurredAt
          })
        })
      case 'library.company.created':
        return this.options.event.on('library.company.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: event.companyId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'library.company.updated':
        return this.options.event.on('library.company.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: event.companyId,
            changes: cloneHostValue(event.changes),
            occurredAt: event.occurredAt
          })
        })
      case 'library.company.deleted':
        return this.options.event.on('library.company.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: event.companyId,
            occurredAt: event.occurredAt
          })
        })
      case 'library.collection.created':
        return this.options.event.on('library.collection.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: event.collectionId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'library.collection.updated':
        return this.options.event.on('library.collection.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: event.collectionId,
            changes: cloneHostValue(
              event.changes
            ) as HostEvents['library.collection.updated']['changes'],
            occurredAt: event.occurredAt
          })
        })
      case 'library.collection.deleted':
        return this.options.event.on('library.collection.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: event.collectionId,
            occurredAt: event.occurredAt
          })
        })
      case 'library.tag.created':
        return this.options.event.on('library.tag.created', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: event.tagId,
            name: event.name,
            occurredAt: event.occurredAt
          })
        })
      case 'library.tag.updated':
        return this.options.event.on('library.tag.updated', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: event.tagId,
            changes: cloneHostValue(event.changes),
            occurredAt: event.occurredAt
          })
        })
      case 'library.tag.deleted':
        return this.options.event.on('library.tag.deleted', (event) => {
          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: event.tagId,
            occurredAt: event.occurredAt
          })
        })
      case 'scanner.completed':
        return this.options.event.on('scanner:completed', ({ scannerId, stats }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { scannerId, stats })
        })
      case 'scanner.failed':
        return this.options.event.on('scanner:error', ({ scannerId, error }) => {
          this.emitSubscriptionEvent(subscriptionId, topic, { scannerId, error })
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

function toHostLibraryGameCreatedEvent(
  event: AppEvents['library.game.created'][0]
): HostEvents['library.game.created'] {
  return {
    gameId: event.gameId,
    name: event.name,
    occurredAt: event.occurredAt
  }
}

function toHostLibraryGameUpdatedEvent(
  event: AppEvents['library.game.updated'][0]
): HostEvents['library.game.updated'] {
  return {
    gameId: event.gameId,
    changes: cloneHostValue(event.changes),
    occurredAt: event.occurredAt
  }
}

function toHostLibraryGameDeletedEvent(
  event: AppEvents['library.game.deleted'][0]
): HostEvents['library.game.deleted'] {
  return {
    gameId: event.gameId,
    occurredAt: event.occurredAt
  }
}

function toHostLibraryPersonCreatedEvent(
  event: AppEvents['library.person.created'][0]
): HostEvents['library.person.created'] {
  return {
    personId: event.personId,
    name: event.name,
    occurredAt: event.occurredAt
  }
}

function toHostLibraryPersonUpdatedEvent(
  event: AppEvents['library.person.updated'][0]
): HostEvents['library.person.updated'] {
  return {
    personId: event.personId,
    changes: cloneHostValue(event.changes),
    occurredAt: event.occurredAt
  }
}

function toHostLibraryPersonDeletedEvent(
  event: AppEvents['library.person.deleted'][0]
): HostEvents['library.person.deleted'] {
  return {
    personId: event.personId,
    occurredAt: event.occurredAt
  }
}

function cloneHostValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

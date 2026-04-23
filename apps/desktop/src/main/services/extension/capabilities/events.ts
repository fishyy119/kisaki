import type { HostEventTopic, HostEvents, SerializableValue } from '@kisaki/extension-api'
import { createValidationError, normalizeCapabilityError } from '@kisaki/extension-api'
import type { DbService } from '@main/services/db'
import type { EventService } from '@main/services/event'
import { eq } from 'drizzle-orm'
import { games } from '@shared/db'
import type { ExtensionHostRpcClient } from '../runtime/rpc-client'

type EventUnsubscribe = () => void

interface HostEventSubscriptionRecord {
  topic: HostEventTopic
  unsubscribe: EventUnsubscribe
}

export interface ExtensionEventsCapabilityHostOptions {
  db: DbService
  event: EventService
}

export class ExtensionEventsCapabilityHost {
  private readonly subscriptions = new Map<string, Map<string, HostEventSubscriptionRecord>>()
  private rpc: ExtensionHostRpcClient | null = null

  constructor(private readonly options: ExtensionEventsCapabilityHostOptions) {}

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

  emitHostEvent<K extends HostEventTopic>(topic: K, payload: HostEvents[K]): void {
    if (!this.rpc) {
      return
    }

    for (const scopedSubscriptions of this.subscriptions.values()) {
      for (const [subscriptionId, record] of scopedSubscriptions) {
        if (record.topic !== topic) {
          continue
        }

        try {
          this.rpc.sendEventToHost('capabilities.events.host', {
            subscriptionId,
            topic,
            payload
          })
        } catch (error) {
          console.warn(`[ExtensionService] Failed to deliver host event "${topic}":`, error)
        }
      }
    }
  }

  private createHostSubscription(topic: HostEventTopic, subscriptionId: string): EventUnsubscribe {
    switch (topic) {
      case 'app.ready':
        return this.options.event.on('app:ready', () => {
          this.emitSubscriptionEvent(subscriptionId, topic, {})
        })
      case 'extension.enabled':
      case 'extension.disabled':
        return () => {}
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
        return this.options.event.on('db:inserted', ({ table, id }) => {
          if (table !== 'games') {
            return
          }

          const game = this.options.db.db.select().from(games).where(eq(games.id, id)).get()

          this.emitSubscriptionEvent(subscriptionId, topic, {
            gameId: id,
            name: game?.name ?? id
          })
        })
      case 'library.game.updated':
        return this.options.event.on('db:updated', ({ table, id }) => {
          if (table !== 'games') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, {
            gameId: id,
            fields: []
          })
        })
      case 'library.game.deleted':
        return this.options.event.on('db:deleted', ({ table, id }) => {
          if (table !== 'games') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, { gameId: id })
        })
      case 'library.person.updated':
        return this.options.event.on('db:updated', ({ table, id }) => {
          if (table !== 'persons') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, {
            personId: id,
            fields: []
          })
        })
      case 'library.character.updated':
        return this.options.event.on('db:updated', ({ table, id }) => {
          if (table !== 'characters') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, {
            characterId: id,
            fields: []
          })
        })
      case 'library.company.updated':
        return this.options.event.on('db:updated', ({ table, id }) => {
          if (table !== 'companies') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, {
            companyId: id,
            fields: []
          })
        })
      case 'library.collection.updated':
        return this.options.event.on('db:updated', ({ table, id }) => {
          if (table !== 'collections') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, {
            collectionId: id,
            fields: []
          })
        })
      case 'library.tag.updated':
        return this.options.event.on('db:updated', ({ table, id }) => {
          if (table !== 'tags') {
            return
          }

          this.emitSubscriptionEvent(subscriptionId, topic, {
            tagId: id,
            fields: []
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
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
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

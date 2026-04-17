import type {
  AppLocale,
  Disposable,
  MaybePromise,
  SerializableRecord,
  SerializableValue
} from '../shared'

export interface HostEvents {
  'app.ready': Record<string, never>
  'app.locale.changed': { locale: AppLocale | null }
  'app.settings.changed': { key: string; value: SerializableValue | undefined }
  'theme.changed': { themeId: string; mode: 'light' | 'dark' | 'system' }
  'extension.enabled': { extensionId: string }
  'extension.disabled': { extensionId: string }
  'library.game.created': { gameId: string; name: string }
  'library.game.updated': { gameId: string; fields: readonly string[] }
  'library.game.deleted': { gameId: string }
  'library.person.updated': { personId: string; fields: readonly string[] }
  'library.character.updated': { characterId: string; fields: readonly string[] }
  'library.company.updated': { companyId: string; fields: readonly string[] }
  'library.collection.updated': { collectionId: string; fields: readonly string[] }
  'library.tag.updated': { tagId: string; fields: readonly string[] }
  'scanner.completed': { scannerId: string; stats: Record<string, number> }
  'scanner.failed': { scannerId: string; error: string }
}

export type HostEventTopic = keyof HostEvents

export type ExtensionEventTopic = `ext.${string}`

export type HostEventListener<K extends HostEventTopic> = (
  payload: HostEvents[K]
) => MaybePromise<void>

export type ExtensionEventPayload = SerializableRecord

export type ExtensionEventListener<TPayload extends ExtensionEventPayload = ExtensionEventPayload> =
  (payload: TPayload) => MaybePromise<void>

export interface EventsCapability {
  on<K extends HostEventTopic>(topic: K, listener: HostEventListener<K>): Promise<Disposable>
  once<K extends HostEventTopic>(topic: K, listener: HostEventListener<K>): Promise<Disposable>
  onExtension<TPayload extends ExtensionEventPayload = ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable>
  emit<TPayload extends ExtensionEventPayload = ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void>
}

export function isExtensionEventTopic(value: string): value is ExtensionEventTopic {
  return /^ext\.[a-z0-9.-]+(\.[a-z0-9.-]+)+$/i.test(value)
}

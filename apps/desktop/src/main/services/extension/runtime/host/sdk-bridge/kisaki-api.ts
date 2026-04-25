import type {
  Disposable,
  ExtensionEventListener,
  ExtensionEventPayload,
  ExtensionEventTopic,
  HostEventListener,
  HostEventTopic,
  KisakiApi,
  RuntimeInfo
} from '@kisaki/extension-api'
import type { ActiveExtensionScope } from './types'

interface KisakiApiBridgeHooks {
  requireCurrentScope(): ActiveExtensionScope
  requestMain<TResult>(
    scope: ActiveExtensionScope,
    method: string,
    params: Record<string, unknown>
  ): Promise<TResult>
  subscribeHostEvent<K extends HostEventTopic>(
    topic: K,
    listener: HostEventListener<K>,
    once: boolean
  ): Promise<Disposable>
  subscribeExtensionEvent<TPayload extends ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    listener: ExtensionEventListener<TPayload>
  ): Promise<Disposable>
  emitExtensionEvent<TPayload extends ExtensionEventPayload>(
    topic: ExtensionEventTopic,
    payload: TPayload
  ): Promise<void>
}

/**
 * Creates the public Kisaki SDK API facade for the active extension scope.
 */
export function createKisakiApi(hooks: KisakiApiBridgeHooks): KisakiApi {
  const requestMain = <TResult>(method: string, params: Record<string, unknown>) => {
    const scope = hooks.requireCurrentScope()
    return hooks.requestMain<TResult>(scope, method, params)
  }

  const createEntityNamespace = (prefix: string) => ({
    get: async (id: string) =>
      (await requestMain<{ entity: unknown }>(`${prefix}.get`, { id })).entity as any,
    list: async (query?: unknown) =>
      (await requestMain<{ items: readonly unknown[] }>(`${prefix}.list`, { query })).items as any,
    create: async (input: unknown) =>
      (await requestMain<{ entity: unknown }>(`${prefix}.create`, { input })).entity as any,
    update: async (id: string, patch: unknown) =>
      (await requestMain<{ entity: unknown }>(`${prefix}.update`, { id, patch })).entity as any,
    remove: async (id: string) => {
      await requestMain(`${prefix}.remove`, { id })
    }
  })

  return {
    library: {
      games: createEntityNamespace('capabilities.library.games'),
      characters: createEntityNamespace('capabilities.library.characters'),
      persons: createEntityNamespace('capabilities.library.persons'),
      companies: createEntityNamespace('capabilities.library.companies'),
      collections: createEntityNamespace('capabilities.library.collections'),
      tags: createEntityNamespace('capabilities.library.tags'),
      relations: {
        list: async (query) =>
          (
            await requestMain<{ items: readonly unknown[] }>(
              'capabilities.library.relations.list',
              {
                query
              }
            )
          ).items as any,
        create: async (input) =>
          (
            await requestMain<{ relation: unknown }>('capabilities.library.relations.create', {
              input
            })
          ).relation as any,
        update: async (selector, patch) =>
          (
            await requestMain<{ relation: unknown }>('capabilities.library.relations.update', {
              selector,
              patch
            })
          ).relation as any,
        remove: async (selector) => {
          await requestMain('capabilities.library.relations.remove', { selector })
        }
      },
      attachments: {
        list: async (entity) =>
          (
            await requestMain<{ items: readonly unknown[] }>(
              'capabilities.library.attachments.list',
              {
                entity
              }
            )
          ).items as any,
        put: async (input) =>
          (
            await requestMain<{ attachment: unknown }>('capabilities.library.attachments.put', {
              input
            })
          ).attachment as any,
        remove: async (input) => {
          await requestMain('capabilities.library.attachments.remove', { input })
        }
      }
    },
    network: {
      request: async (input) =>
        (await requestMain<{ response: unknown }>('capabilities.network.request', { input }))
          .response as any,
      download: async (input) =>
        (await requestMain<{ result: unknown }>('capabilities.network.download', { input }))
          .result as any
    },
    notify: {
      success: async (title, options) =>
        (
          await requestMain<{ handle: unknown }>('capabilities.notify.show', {
            kind: 'success',
            title,
            options
          })
        ).handle as any,
      info: async (title, options) =>
        (
          await requestMain<{ handle: unknown }>('capabilities.notify.show', {
            kind: 'info',
            title,
            options
          })
        ).handle as any,
      warning: async (title, options) =>
        (
          await requestMain<{ handle: unknown }>('capabilities.notify.show', {
            kind: 'warning',
            title,
            options
          })
        ).handle as any,
      error: async (title, options) =>
        (
          await requestMain<{ handle: unknown }>('capabilities.notify.show', {
            kind: 'error',
            title,
            options
          })
        ).handle as any,
      loading: async (title, options) =>
        (
          await requestMain<{ handle: unknown }>('capabilities.notify.show', {
            kind: 'loading',
            title,
            options
          })
        ).handle as any,
      update: async (id, kind, title, options) => {
        await requestMain('capabilities.notify.update', {
          id,
          kind,
          title,
          options
        })
      },
      dismiss: async (id) => {
        await requestMain('capabilities.notify.dismiss', { id })
      }
    },
    events: {
      on: async (topic, listener) => hooks.subscribeHostEvent(topic, listener, false),
      once: async (topic, listener) => hooks.subscribeHostEvent(topic, listener, true),
      onExtension: async (topic, listener) => hooks.subscribeExtensionEvent(topic, listener),
      emit: async (topic, payload) => hooks.emitExtensionEvent(topic, payload)
    },
    runtime: {
      getInfo: async () => {
        return (await requestMain<{ info: RuntimeInfo }>('capabilities.runtime.getInfo', {})).info
      },
      delay: async (ms: number) => {
        await new Promise((resolve) => setTimeout(resolve, ms))
      }
    }
  }
}

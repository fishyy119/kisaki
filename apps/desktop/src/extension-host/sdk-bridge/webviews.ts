import type {
  ExtensionRuntimeHandle,
  HostToMainRpcRequestMap,
  JsonValue,
  RpcParams,
  RpcResult,
  UndefinedTolerant,
  WebviewClosedEvent,
  WebviewHandle,
  WebviewMessagePostedEvent
} from '@kisaki3/extension-api'
import { createDisposable } from './disposables'
import type { ActiveExtensionScope, WebviewSessionBinding } from './types'

interface WebviewSessionRecord {
  scope: ActiveExtensionScope
  controller: AbortController
  messageListeners: Set<(message: JsonValue) => void>
  closeListeners: Set<() => void>
  buffered: JsonValue[]
}

type WebviewSessionRpcMethod = 'capabilities.webviews.postMessage' | 'capabilities.webviews.close'

export interface HostWebviewSessionManagerOptions {
  runInExtensionContext<T>(
    scope: ActiveExtensionScope,
    callback: () => Promise<T> | T
  ): Promise<T> | T
  requestMain<K extends WebviewSessionRpcMethod>(
    scope: ActiveExtensionScope,
    method: K,
    params: UndefinedTolerant<Omit<RpcParams<HostToMainRpcRequestMap, K>, 'runtimeHandle'>>
  ): Promise<RpcResult<HostToMainRpcRequestMap, K>>
}

/**
 * Tracks open webview sessions inside the extension host process and routes
 * main-relayed messages and close notifications to author callbacks.
 * @remarks Inbound messages are buffered per session until the first message
 * listener registers, so wiring listeners right after an open resolves never
 * drops messages. Sessions follow a one-way lifecycle and are finalized at
 * most once. A webview id maps to a single record, so handles produced for
 * the same session (open result and `onOpen` dispatch) share listeners.
 */
export class HostWebviewSessionManager {
  private readonly sessions = new Map<string, WebviewSessionRecord>()

  constructor(private readonly options: HostWebviewSessionManagerOptions) {}

  /**
   * Creates the author-facing handle for a session, adopting the existing
   * record when the session is already tracked.
   */
  createHandle(scope: ActiveExtensionScope, webviewId: string): WebviewHandle {
    const binding = this.register(scope, webviewId)

    return {
      id: webviewId,
      signal: binding.signal,
      postMessage: async (message) => {
        await this.options.requestMain(scope, 'capabilities.webviews.postMessage', {
          webviewId,
          message
        })
      },
      onMessage: (listener) => binding.onMessage(listener),
      onClose: (listener) => binding.onClose(listener),
      close: async () => {
        await this.options.requestMain(scope, 'capabilities.webviews.close', { webviewId })
      }
    }
  }

  register(scope: ActiveExtensionScope, webviewId: string): WebviewSessionBinding {
    let record = this.sessions.get(webviewId)
    if (!record || record.scope.runtimeHandle !== scope.runtimeHandle) {
      record = {
        scope,
        controller: new AbortController(),
        messageListeners: new Set(),
        closeListeners: new Set(),
        buffered: []
      }
      this.sessions.set(webviewId, record)
    }

    const boundRecord = record
    return {
      signal: boundRecord.controller.signal,
      onMessage: (listener) => {
        boundRecord.messageListeners.add(listener)

        if (boundRecord.buffered.length > 0) {
          const pending = boundRecord.buffered.splice(0, boundRecord.buffered.length)
          for (const message of pending) {
            void this.dispatchMessage(boundRecord, message)
          }
        }

        return createDisposable(() => {
          boundRecord.messageListeners.delete(listener)
        })
      },
      onClose: (listener) => {
        boundRecord.closeListeners.add(listener)
        return createDisposable(() => {
          boundRecord.closeListeners.delete(listener)
        })
      }
    }
  }

  async handleMessagePosted(payload: WebviewMessagePostedEvent): Promise<void> {
    const record = this.sessions.get(payload.webviewId)
    if (!record || record.scope.runtimeHandle !== payload.runtimeHandle) {
      return
    }

    if (record.messageListeners.size === 0) {
      record.buffered.push(payload.message)
      return
    }

    await this.dispatchMessage(record, payload.message)
  }

  async handleClosed(payload: WebviewClosedEvent): Promise<void> {
    const record = this.sessions.get(payload.webviewId)
    if (!record || record.scope.runtimeHandle !== payload.runtimeHandle) {
      return
    }

    this.sessions.delete(payload.webviewId)
    record.controller.abort()

    for (const listener of [...record.closeListeners]) {
      try {
        await this.options.runInExtensionContext(record.scope, () => Promise.resolve(listener()))
      } catch (error) {
        console.warn(
          `[ExtensionHost][${record.scope.extensionId}] Webview close listener failed:`,
          error
        )
      }
    }
    record.closeListeners.clear()
    record.messageListeners.clear()
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [webviewId, record] of [...this.sessions]) {
      if (record.scope.runtimeHandle !== runtimeHandle) {
        continue
      }

      this.sessions.delete(webviewId)
      record.controller.abort()
      record.closeListeners.clear()
      record.messageListeners.clear()
    }
  }

  releaseAll(): void {
    for (const record of this.sessions.values()) {
      record.controller.abort()
      record.closeListeners.clear()
      record.messageListeners.clear()
    }
    this.sessions.clear()
  }

  private async dispatchMessage(record: WebviewSessionRecord, message: JsonValue): Promise<void> {
    for (const listener of [...record.messageListeners]) {
      try {
        await this.options.runInExtensionContext(record.scope, () =>
          Promise.resolve(listener(message))
        )
      } catch (error) {
        console.warn(
          `[ExtensionHost][${record.scope.extensionId}] Webview message listener failed:`,
          error
        )
      }
    }
  }
}

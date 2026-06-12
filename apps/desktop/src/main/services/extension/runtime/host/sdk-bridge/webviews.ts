import type {
  ExtensionRuntimeHandle,
  JsonValue,
  WebviewClosedEvent,
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

export interface HostWebviewSessionManagerOptions {
  runInExtensionContext<T>(
    scope: ActiveExtensionScope,
    callback: () => Promise<T> | T
  ): Promise<T> | T
}

/**
 * Tracks open webview sessions inside the extension host process and routes
 * main-relayed messages and close notifications to author callbacks.
 * @remarks Inbound messages are buffered per session until the first message
 * listener registers, so wiring listeners right after `open()` resolves never
 * drops messages. Sessions follow a one-way lifecycle and are finalized at
 * most once.
 */
export class HostWebviewSessionManager {
  private readonly sessions = new Map<string, WebviewSessionRecord>()

  constructor(private readonly options: HostWebviewSessionManagerOptions) {}

  register(scope: ActiveExtensionScope, webviewId: string): WebviewSessionBinding {
    const record: WebviewSessionRecord = {
      scope,
      controller: new AbortController(),
      messageListeners: new Set(),
      closeListeners: new Set(),
      buffered: []
    }
    this.sessions.set(webviewId, record)

    return {
      signal: record.controller.signal,
      onMessage: (listener) => {
        record.messageListeners.add(listener)

        if (record.buffered.length > 0) {
          const pending = record.buffered.splice(0, record.buffered.length)
          for (const message of pending) {
            void this.dispatchMessage(record, message)
          }
        }

        return createDisposable(() => {
          record.messageListeners.delete(listener)
        })
      },
      onClose: (listener) => {
        record.closeListeners.add(listener)
        return createDisposable(() => {
          record.closeListeners.delete(listener)
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

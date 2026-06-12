import { randomUUID } from 'node:crypto'
import {
  createUnavailableError,
  createValidationError,
  normalizeExtensionPackagePath,
  validateJsonValue,
  validateWebviewOpenOptionsShape,
  type ExtensionRuntimeMetadata,
  type JsonValue,
  type WebviewOpenOptions
} from '@kisaki3/extension-api'
import { createLogger } from '@main/log'
import type { ExtensionWebviewMessageEvent, ExtensionWebviewSessionInfo } from '@shared/extension'
import type { ExtensionWebviewUiSource } from '../packages'
import type { ExtensionHostRpcClient } from '../runtime'

const log = createLogger('Extension')

export interface ExtensionWebviewsCapabilityProviderOptions {
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
  resolveUiSource(extensionId: string): ExtensionWebviewUiSource | null
  buildPackageDocumentUrl(extensionId: string, entry: string): string
  onSessionsChanged(sessions: readonly ExtensionWebviewSessionInfo[]): void
  onWebviewMessage(event: ExtensionWebviewMessageEvent): void
}

interface WebviewSession {
  info: ExtensionWebviewSessionInfo
  runtimeHandle: string
  ready: boolean
  pendingMessages: JsonValue[]
}

/**
 * Main-process owner of webview sessions. Holds the single source of truth
 * for open sessions, relays messages between the extension host and the
 * renderer, and buffers host messages until the webview document signals
 * readiness. Sessions follow a one-way lifecycle; message delivery to closed
 * or unknown sessions is dropped so close races never surface as errors.
 */
export class ExtensionWebviewsCapabilityProvider {
  private readonly sessions = new Map<string, WebviewSession>()
  private rpc: ExtensionHostRpcClient | null = null

  constructor(private readonly options: ExtensionWebviewsCapabilityProviderOptions) {}

  attachRpc(rpc: ExtensionHostRpcClient): void {
    this.rpc = rpc
  }

  detachRpc(): void {
    this.rpc = null
  }

  open(runtimeHandle: string, options: WebviewOpenOptions): { webviewId: string } {
    const metadata = this.requireRuntime(runtimeHandle)
    const issues = validateWebviewOpenOptionsShape(options)
    if (issues.length > 0) {
      throw createValidationError(
        `Webview open options are invalid:\n${issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('\n')}`
      )
    }

    const entry = normalizeExtensionPackagePath(options.entry)
    if (!entry) {
      throw createValidationError('Webview entry must stay inside the manifest ui root.')
    }

    const source = this.options.resolveUiSource(metadata.id)
    if (!source) {
      throw createValidationError(
        `Extension "${metadata.id}" cannot open webviews because its manifest does not declare a ui root.`
      )
    }

    const session: WebviewSession = {
      info: {
        webviewId: randomUUID(),
        extensionId: metadata.id,
        extensionName: metadata.name,
        title: options.title,
        surface: options.surface,
        entry,
        params: options.params ?? {},
        documentUrl: this.buildDocumentUrl(source, metadata.id, entry),
        openedAt: Date.now()
      },
      runtimeHandle,
      ready: false,
      pendingMessages: []
    }

    this.sessions.set(session.info.webviewId, session)
    this.notifySessionsChanged()
    return { webviewId: session.info.webviewId }
  }

  close(runtimeHandle: string, webviewId: string): void {
    const session = this.sessions.get(webviewId)
    if (!session || session.runtimeHandle !== runtimeHandle) {
      return
    }

    this.finalizeSession(session)
  }

  postMessageToWebview(runtimeHandle: string, webviewId: string, message: JsonValue): void {
    const session = this.sessions.get(webviewId)
    if (!session || session.runtimeHandle !== runtimeHandle) {
      return
    }

    if (!session.ready) {
      session.pendingMessages.push(message)
      return
    }

    this.options.onWebviewMessage({ webviewId, message })
  }

  listSessions(): readonly ExtensionWebviewSessionInfo[] {
    return [...this.sessions.values()]
      .map((session) => session.info)
      .sort((left, right) => left.openedAt - right.openedAt)
  }

  notifyReady(webviewId: string): void {
    const session = this.sessions.get(webviewId)
    if (!session) {
      return
    }

    session.ready = true
    if (session.pendingMessages.length === 0) {
      return
    }

    const pending = session.pendingMessages.splice(0, session.pendingMessages.length)
    for (const message of pending) {
      this.options.onWebviewMessage({ webviewId, message })
    }
  }

  postMessageToHost(webviewId: string, message: JsonValue): void {
    const session = this.sessions.get(webviewId)
    if (!session) {
      return
    }

    // The renderer relays this value from the untrusted webview document, so
    // main validates the JSON model before the value enters the host link.
    const issues = validateJsonValue(message, 'message')
    if (issues.length > 0) {
      log.warn(
        `Dropped invalid webview message from "${session.info.extensionId}" webview "${webviewId}".`,
        issues
      )
      throw createValidationError(
        `Webview message is invalid:\n${issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('\n')}`
      )
    }

    this.rpc?.sendEventToHost('capabilities.webviews.messagePosted', {
      runtimeHandle: session.runtimeHandle,
      webviewId,
      message
    })
  }

  closeFromRenderer(webviewId: string): void {
    const session = this.sessions.get(webviewId)
    if (!session) {
      return
    }

    this.finalizeSession(session)
  }

  releaseRuntime(runtimeHandle: string): void {
    for (const session of [...this.sessions.values()]) {
      if (session.runtimeHandle === runtimeHandle) {
        this.finalizeSession(session)
      }
    }
  }

  releaseAll(): void {
    if (this.sessions.size === 0) {
      return
    }

    this.sessions.clear()
    this.notifySessionsChanged()
  }

  private finalizeSession(session: WebviewSession): void {
    this.sessions.delete(session.info.webviewId)
    this.rpc?.sendEventToHost('capabilities.webviews.closed', {
      runtimeHandle: session.runtimeHandle,
      webviewId: session.info.webviewId
    })
    this.notifySessionsChanged()
  }

  private buildDocumentUrl(
    source: ExtensionWebviewUiSource,
    extensionId: string,
    entry: string
  ): string {
    if (source.kind === 'dev-server') {
      return `${source.origin}/${entry}`
    }

    return this.options.buildPackageDocumentUrl(extensionId, entry)
  }

  private notifySessionsChanged(): void {
    try {
      this.options.onSessionsChanged(this.listSessions())
    } catch (error) {
      log.warn('Failed to notify webview sessions changed.', error)
    }
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

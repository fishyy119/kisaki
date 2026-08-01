import { randomUUID } from 'node:crypto'
import {
  createNotFoundError,
  createValidationError,
  validateJsonValue,
  type JsonObject,
  type JsonValue
} from '@kisaki3/extension-api'
import { createLogger } from '@main/log'
import type {
  ExtensionWebviewMessageEvent,
  ExtensionWebviewOpenPageRequest,
  ExtensionWebviewSessionInfo,
  ExtensionWebviewSurfaceInfo
} from '@shared/extension'
import type {
  ExtensionWebviewDialogRegistration,
  ExtensionWebviewPageRegistration
} from '../contributions/webviews'
import type { ExtensionHostRpcClient } from '../runtime'

const log = createLogger('Extension')

export interface ExtensionWebviewSessionManagerOptions {
  resolveDocumentUrl(extensionId: string, entry: string): string | null
  resolvePage(runtimeHandle: string, pageId: string): ExtensionWebviewPageRegistration | null
  resolveDialog(runtimeHandle: string, dialogId: string): ExtensionWebviewDialogRegistration | null
  resolvePageByExtension(
    extensionId: string,
    pageId: string
  ): ExtensionWebviewPageRegistration | null
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
 * Main-process owner of live webview sessions, the runtime state that bridges
 * the extension host and the renderer. Sessions open only against declared
 * page/dialog contributions with at most one live session per declared id:
 * reopening a page replaces its session (navigation semantics), reopening a
 * dialog adopts the existing one. Holds the single source of truth for open
 * sessions, relays messages between the extension host and the renderer, and
 * buffers host messages until the webview document signals readiness.
 * Sessions follow a one-way lifecycle; message delivery to closed or unknown
 * sessions is dropped so close races never surface as errors.
 *
 * Callers own direction-specific auth: the webviews capability provider
 * validates extension-side requests, renderer IPC lands here directly.
 */
export class ExtensionWebviewSessionManager {
  private readonly sessions = new Map<string, WebviewSession>()
  private rpc: ExtensionHostRpcClient | null = null

  constructor(private readonly options: ExtensionWebviewSessionManagerOptions) {}

  attachRpc(rpc: ExtensionHostRpcClient): void {
    this.rpc = rpc
  }

  detachRpc(): void {
    this.rpc = null
  }

  openPage(
    runtimeHandle: string,
    extensionId: string,
    pageId: string,
    params: JsonObject
  ): { webviewId: string } {
    const registration = this.options.resolvePage(runtimeHandle, pageId)
    if (!registration) {
      throw createNotFoundError(
        `Webview page "${pageId}" is not declared by extension "${extensionId}".`
      )
    }

    // Navigation semantics: reopening a page replaces the live session so the
    // new params apply.
    const existing = this.findSurfaceSession(extensionId, 'page', pageId)
    if (existing) {
      this.finalizeSession(existing)
    }

    const session = this.createSession({
      runtimeHandle,
      extensionId,
      title: registration.page.title,
      entry: registration.page.entry,
      surface: { kind: 'page', pageId },
      params
    })
    this.emitOpened(session)
    return { webviewId: session.info.webviewId }
  }

  openDialog(
    runtimeHandle: string,
    extensionId: string,
    dialogId: string,
    params: JsonObject
  ): { webviewId: string } {
    const registration = this.options.resolveDialog(runtimeHandle, dialogId)
    if (!registration) {
      throw createNotFoundError(
        `Webview dialog "${dialogId}" is not declared by extension "${extensionId}".`
      )
    }

    // Idempotent open: a live dialog session is adopted, so double-triggers
    // never stack modal windows.
    const existing = this.findSurfaceSession(extensionId, 'dialog', dialogId)
    if (existing) {
      return { webviewId: existing.info.webviewId }
    }

    const session = this.createSession({
      runtimeHandle,
      extensionId,
      title: registration.dialog.title,
      entry: registration.dialog.entry,
      surface: { kind: 'dialog', dialogId, size: registration.dialog.size ?? 'md' },
      params
    })
    this.emitOpened(session)
    return { webviewId: session.info.webviewId }
  }

  /**
   * Renderer-initiated page open (route entry). Adopts the live session when
   * the page is already open; otherwise opens a fresh session without params.
   */
  openPageFromRenderer(request: ExtensionWebviewOpenPageRequest): ExtensionWebviewSessionInfo {
    const registration = this.options.resolvePageByExtension(request.extensionId, request.pageId)
    if (!registration) {
      throw createNotFoundError(
        `Webview page "${request.pageId}" is not declared by extension "${request.extensionId}".`
      )
    }

    const existing = this.findSurfaceSession(request.extensionId, 'page', request.pageId)
    if (existing) {
      return existing.info
    }

    const session = this.createSession({
      runtimeHandle: registration.owner.runtimeHandle,
      extensionId: request.extensionId,
      title: registration.page.title,
      entry: registration.page.entry,
      surface: { kind: 'page', pageId: request.pageId },
      params: {}
    })
    this.emitOpened(session)
    return session.info
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
      this.options.onWebviewMessage({ webviewId: session.info.webviewId, message })
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

  private createSession(input: {
    runtimeHandle: string
    extensionId: string
    title: ExtensionWebviewSessionInfo['title']
    entry: string
    surface: ExtensionWebviewSurfaceInfo
    params: JsonObject
  }): WebviewSession {
    const documentUrl = this.options.resolveDocumentUrl(input.extensionId, input.entry)
    if (!documentUrl) {
      throw createValidationError(
        `Extension "${input.extensionId}" cannot open webviews because its manifest does not declare a ui root.`
      )
    }

    const session: WebviewSession = {
      info: {
        webviewId: randomUUID(),
        extensionId: input.extensionId,
        title: input.title,
        surface: input.surface,
        params: input.params,
        documentUrl,
        openedAt: Date.now()
      },
      runtimeHandle: input.runtimeHandle,
      ready: false,
      pendingMessages: []
    }

    this.sessions.set(session.info.webviewId, session)
    this.notifySessionsChanged()
    return session
  }

  private emitOpened(session: WebviewSession): void {
    this.rpc?.sendEventToHost('capabilities.webviews.opened', {
      runtimeHandle: session.runtimeHandle,
      webviewId: session.info.webviewId,
      surface:
        session.info.surface.kind === 'page'
          ? { kind: 'page', pageId: session.info.surface.pageId }
          : { kind: 'dialog', dialogId: session.info.surface.dialogId },
      params: session.info.params
    })
  }

  private findSurfaceSession(
    extensionId: string,
    kind: ExtensionWebviewSurfaceInfo['kind'],
    surfaceId: string
  ): WebviewSession | null {
    for (const session of this.sessions.values()) {
      if (session.info.extensionId !== extensionId || session.info.surface.kind !== kind) {
        continue
      }

      const sessionSurfaceId =
        session.info.surface.kind === 'page'
          ? session.info.surface.pageId
          : session.info.surface.dialogId
      if (sessionSurfaceId === surfaceId) {
        return session
      }
    }

    return null
  }

  private finalizeSession(session: WebviewSession): void {
    this.sessions.delete(session.info.webviewId)
    this.rpc?.sendEventToHost('capabilities.webviews.closed', {
      runtimeHandle: session.runtimeHandle,
      webviewId: session.info.webviewId
    })
    this.notifySessionsChanged()
  }

  private notifySessionsChanged(): void {
    try {
      this.options.onSessionsChanged(this.listSessions())
    } catch (error) {
      log.warn('Failed to notify webview sessions changed.', error)
    }
  }
}

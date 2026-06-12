import { computed, shallowRef } from 'vue'
import type { JsonValue } from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionInfo } from '@shared/extension'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { router } from '@renderer/core/router'

const log = createLogger('Extension')

const sessions = shallowRef<readonly ExtensionWebviewSessionInfo[]>([])
const frameMessageHandlers = new Map<string, (message: JsonValue) => void>()
let unsubscribeSessions: (() => void) | null = null

/**
 * Renderer projection of main-owned webview sessions. Dialog sessions render
 * through the global webview dialog host; the newest page session drives the
 * `/extension-webview/:webviewId` route.
 */
export const extensionWebviewStore = {
  sessions,
  dialogSessions: computed(() =>
    sessions.value.filter((session) => session.surface.kind === 'dialog')
  ),
  pageSessions: computed(() => sessions.value.filter((session) => session.surface.kind === 'page'))
}

export function getExtensionWebviewSession(webviewId: string): ExtensionWebviewSessionInfo | null {
  return sessions.value.find((session) => session.webviewId === webviewId) ?? null
}

export function setupExtensionWebviewStore(): void {
  if (unsubscribeSessions) {
    return
  }

  unsubscribeSessions = ipcManager.on('extension:webview-sessions-changed', (_event, next) => {
    applySessions(next)
  })
  ipcManager.on('extension:webview-message', (_event, event) => {
    frameMessageHandlers.get(event.webviewId)?.(event.message)
  })

  void ipcManager
    .invoke('extension:get-webview-sessions')
    .then(unwrapIpcData)
    .then((next) => {
      applySessions(next)
    })
    .catch((error) => {
      log.error('Failed to load extension webview sessions:', error)
    })
}

/**
 * Binds the mounted frame that renders one webview session as the receiver of
 * host-posted messages relayed through main.
 */
export function registerWebviewFrame(
  webviewId: string,
  onHostMessage: (message: JsonValue) => void
): () => void {
  frameMessageHandlers.set(webviewId, onHostMessage)
  return () => {
    if (frameMessageHandlers.get(webviewId) === onHostMessage) {
      frameMessageHandlers.delete(webviewId)
    }
  }
}

export async function notifyWebviewReady(webviewId: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:notify-webview-ready', { webviewId }))
}

export async function postWebviewMessage(webviewId: string, message: JsonValue): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:post-webview-message', { webviewId, message }))
}

export async function closeWebview(webviewId: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('extension:close-webview', { webviewId }))
}

function applySessions(next: readonly ExtensionWebviewSessionInfo[]): void {
  const previousPageIds = new Set(
    sessions.value
      .filter((session) => session.surface.kind === 'page')
      .map((session) => session.webviewId)
  )
  sessions.value = next

  const pageSessions = next.filter((session) => session.surface.kind === 'page')
  const openedPage = pageSessions.findLast((session) => !previousPageIds.has(session.webviewId))
  if (openedPage) {
    void router.push({
      name: 'extension-webview',
      params: { webviewId: openedPage.webviewId }
    })
    return
  }

  const route = router.currentRoute.value
  if (route.name !== 'extension-webview') {
    return
  }

  const activeWebviewId = route.params.webviewId
  const stillOpen = pageSessions.some((session) => session.webviewId === activeWebviewId)
  if (stillOpen) {
    return
  }

  if (window.history.length > 1) {
    router.back()
  } else {
    void router.replace('/library')
  }
}

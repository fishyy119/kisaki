import type {
  Disposable,
  JsonObject,
  JsonValue,
  WebviewBootstrapPayload,
  WebviewClient,
  WebviewClientEnvelope,
  WebviewEmbedderEnvelope,
  WebviewTheme
} from '@kisaki3/extension-api'
import { WEBVIEW_BOOTSTRAP_QUERY_PARAM, toJsonValue } from '@kisaki3/extension-api'

export { createWebviewRpc } from './shared/webview-rpc'
export type {
  WebviewRpcFunctions,
  WebviewRpcRemote,
  WebviewRpcTransport
} from './shared/webview-rpc'
export type {
  Disposable,
  JsonObject,
  JsonValue,
  WebviewBootstrapPayload,
  WebviewClient,
  WebviewTheme
} from '@kisaki3/extension-api'

interface WebviewClientConnection {
  readonly bootstrap: WebviewBootstrapPayload
  theme: WebviewTheme
}

const messageListeners = new Set<(message: JsonValue) => void>()
const themeListeners = new Set<(theme: WebviewTheme) => void>()
const bufferedMessages: JsonValue[] = []

const connection = connect()

function readBootstrap(): WebviewBootstrapPayload | null {
  const raw = new URLSearchParams(window.location.search).get(WEBVIEW_BOOTSTRAP_QUERY_PARAM)
  if (!raw) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return isBootstrapPayload(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isBootstrapPayload(value: unknown): value is WebviewBootstrapPayload {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.webviewId === 'string' &&
    value.webviewId.length > 0 &&
    typeof value.extensionId === 'string' &&
    value.extensionId.length > 0 &&
    isRecord(value.params) &&
    isWebviewTheme(value.theme)
  )
}

function isWebviewTheme(value: unknown): value is WebviewTheme {
  if (!isRecord(value) || (value.mode !== 'light' && value.mode !== 'dark')) {
    return false
  }

  return (
    isRecord(value.tokens) &&
    Object.values(value.tokens).every((token) => typeof token === 'string')
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isEmbedderEnvelope(value: unknown): value is WebviewEmbedderEnvelope {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    typeof (value as { type?: unknown }).type === 'string' &&
    (value as { type: string }).type.startsWith('kisaki-webview:')
  )
}

function toThemeCssVariableName(tokenName: string): string {
  return `--kisaki-${tokenName.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)}`
}

/**
 * Mirrors the active app theme onto the document: semantic tokens become
 * `--kisaki-*` CSS variables and the mode lands on `data-kisaki-theme` plus
 * the standard `color-scheme`.
 */
function applyThemeToDocument(theme: WebviewTheme): void {
  const root = document.documentElement
  for (const [tokenName, tokenValue] of Object.entries(theme.tokens)) {
    root.style.setProperty(toThemeCssVariableName(tokenName), tokenValue)
  }

  root.dataset.kisakiTheme = theme.mode
  root.style.colorScheme = theme.mode
}

function postToEmbedder(envelope: WebviewClientEnvelope): void {
  window.parent.postMessage(envelope, '*')
}

function dispatchMessage(message: JsonValue): void {
  if (messageListeners.size === 0) {
    bufferedMessages.push(message)
    return
  }

  for (const listener of messageListeners) {
    listener(message)
  }
}

function connect(): WebviewClientConnection | null {
  if (typeof window === 'undefined' || window.parent === window) {
    return null
  }

  const bootstrap = readBootstrap()
  if (!bootstrap) {
    return null
  }

  const state: WebviewClientConnection = {
    bootstrap,
    theme: bootstrap.theme
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || !isEmbedderEnvelope(event.data)) {
      return
    }

    const envelope = event.data
    if (envelope.type === 'kisaki-webview:message') {
      dispatchMessage(envelope.message)
      return
    }

    if (envelope.type === 'kisaki-webview:theme') {
      state.theme = envelope.theme
      applyThemeToDocument(envelope.theme)
      for (const listener of themeListeners) {
        listener(envelope.theme)
      }
    }
  })

  applyThemeToDocument(bootstrap.theme)
  postToEmbedder({ type: 'kisaki-webview:ready', webviewId: bootstrap.webviewId })

  return state
}

function requireConnection(): WebviewClientConnection {
  if (!connection) {
    throw new Error(
      'This document is not embedded as a Kisaki webview. The webview client is only available inside webviews opened through kisaki.webviews.open().'
    )
  }

  return connection
}

/**
 * This webview's connection to its extension host code.
 * @remarks Initialized synchronously from the bootstrap payload on the
 * document URL. Inbound messages are buffered until the first `onMessage`
 * listener registers, so attach listeners during startup and nothing is lost.
 */
export const webview: WebviewClient = {
  get id() {
    return requireConnection().bootstrap.webviewId
  },
  get extensionId() {
    return requireConnection().bootstrap.extensionId
  },
  get params(): JsonObject {
    return requireConnection().bootstrap.params
  },
  get theme(): WebviewTheme {
    return requireConnection().theme
  },
  onThemeChange(listener: (theme: WebviewTheme) => void): Disposable {
    requireConnection()
    themeListeners.add(listener)
    return {
      dispose() {
        themeListeners.delete(listener)
      }
    }
  },
  postMessage(message: JsonValue): void {
    const { bootstrap } = requireConnection()
    postToEmbedder({
      type: 'kisaki-webview:message',
      webviewId: bootstrap.webviewId,
      // Normalize at the transport gate so non-JSON input fails here instead
      // of being silently mangled by structured clone along the relay.
      message: toJsonValue(message, 'webview message')
    })
  },
  onMessage(listener: (message: JsonValue) => void): Disposable {
    requireConnection()
    messageListeners.add(listener)

    if (bufferedMessages.length > 0) {
      const pending = bufferedMessages.splice(0, bufferedMessages.length)
      for (const message of pending) {
        dispatchMessage(message)
      }
    }

    return {
      dispose() {
        messageListeners.delete(listener)
      }
    }
  },
  close(): void {
    const { bootstrap } = requireConnection()
    postToEmbedder({ type: 'kisaki-webview:close', webviewId: bootstrap.webviewId })
  }
}

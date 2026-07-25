import type {
  Disposable,
  JsonObject,
  JsonValue,
  UiLocale,
  WebviewAppearance,
  WebviewBootstrapPayload,
  WebviewClient,
  WebviewClientEnvelope,
  WebviewEmbedderEnvelope,
  WebviewTheme,
  WebviewTypography
} from '@kisaki3/extension-api'
import { UI_LOCALES, WEBVIEW_BOOTSTRAP_QUERY_PARAM, toJsonValue } from '@kisaki3/extension-api'

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
  UiLocale,
  WebviewAppearance,
  WebviewBootstrapPayload,
  WebviewClient,
  WebviewTheme,
  WebviewThemeTokenMap,
  WebviewThemeTokenName,
  WebviewTypography
} from '@kisaki3/extension-api'

interface WebviewClientConnection {
  readonly bootstrap: WebviewBootstrapPayload
  theme: WebviewTheme
  typography: WebviewTypography
  uiLocale: UiLocale
}

const messageListeners = new Set<(message: JsonValue) => void>()
const themeListeners = new Set<(theme: WebviewTheme) => void>()
const typographyListeners = new Set<(typography: WebviewTypography) => void>()
const uiLocaleListeners = new Set<(uiLocale: UiLocale) => void>()
const bufferedMessages: JsonValue[] = []
const injectedFontStylesheets = new Map<string, HTMLLinkElement>()

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
    isWebviewAppearance(value.appearance) &&
    isUiLocale(value.uiLocale)
  )
}

function isUiLocale(value: unknown): value is UiLocale {
  return typeof value === 'string' && (UI_LOCALES as readonly string[]).includes(value)
}

function isWebviewAppearance(value: unknown): value is WebviewAppearance {
  return isRecord(value) && isWebviewTheme(value.theme) && isWebviewTypography(value.typography)
}

function isWebviewTheme(value: unknown): value is WebviewTheme {
  if (!isRecord(value) || (value.mode !== 'light' && value.mode !== 'dark')) {
    return false
  }

  return (
    typeof value.radius === 'string' &&
    isRecord(value.tokens) &&
    Object.values(value.tokens).every((token) => typeof token === 'string')
  )
}

function isWebviewTypography(value: unknown): value is WebviewTypography {
  if (!isRecord(value) || typeof value.sans !== 'string' || typeof value.mono !== 'string') {
    return false
  }

  return (
    typeof value.baseSize === 'string' &&
    typeof value.baseWeight === 'string' &&
    typeof value.baseLineHeight === 'string' &&
    typeof value.baseLetterSpacing === 'string' &&
    Array.isArray(value.stylesheets) &&
    value.stylesheets.every((stylesheet) => typeof stylesheet === 'string')
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
 * `--kisaki-*` CSS variables, the radius lands on `--kisaki-radius`, and the
 * mode lands on `data-kisaki-theme` plus the standard `color-scheme`.
 */
function applyThemeToDocument(theme: WebviewTheme): void {
  const root = document.documentElement
  for (const [tokenName, tokenValue] of Object.entries(theme.tokens)) {
    root.style.setProperty(toThemeCssVariableName(tokenName), tokenValue)
  }

  root.style.setProperty('--kisaki-radius', theme.radius)
  root.dataset.kisakiTheme = theme.mode
  root.style.colorScheme = theme.mode
}

/**
 * Mirrors the resolved app typography onto the document: reconciles the font
 * stylesheets (unicode-range sliced @font-face rules, so only used slices are
 * fetched), the font stacks as `--kisaki-font-*`, and the base metrics as
 * `--kisaki-text-*`. Faces use `swap` display, so text renders with fallbacks
 * until they arrive; a missing stylesheet is cosmetic only.
 */
function applyTypographyToDocument(typography: WebviewTypography): void {
  reconcileFontStylesheets(typography.stylesheets)

  const root = document.documentElement
  root.style.setProperty('--kisaki-font-sans', typography.sans)
  root.style.setProperty('--kisaki-font-mono', typography.mono)
  root.style.setProperty('--kisaki-text-size', typography.baseSize)
  root.style.setProperty('--kisaki-text-weight', typography.baseWeight)
  root.style.setProperty('--kisaki-text-line-height', typography.baseLineHeight)
  root.style.setProperty('--kisaki-text-letter-spacing', typography.baseLetterSpacing)
}

/**
 * Adds newly-declared font stylesheets and removes ones no longer present, so
 * repeated appearance pushes never duplicate `<link>` elements (and a future
 * custom-font change drops stale faces).
 */
function reconcileFontStylesheets(stylesheets: readonly string[]): void {
  const head = document.head ?? document.documentElement
  const next = new Set(stylesheets)

  for (const [href, link] of injectedFontStylesheets) {
    if (!next.has(href)) {
      link.remove()
      injectedFontStylesheets.delete(href)
    }
  }

  for (const href of stylesheets) {
    if (injectedFontStylesheets.has(href)) {
      continue
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    head.appendChild(link)
    injectedFontStylesheets.set(href, link)
  }
}

function applyAppearanceToDocument(appearance: WebviewAppearance): void {
  applyThemeToDocument(appearance.theme)
  applyTypographyToDocument(appearance.typography)
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
    theme: bootstrap.appearance.theme,
    typography: bootstrap.appearance.typography,
    uiLocale: bootstrap.uiLocale
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

    if (envelope.type === 'kisaki-webview:appearance') {
      applyAppearance(state, envelope.appearance)
      return
    }

    if (envelope.type === 'kisaki-webview:ui-locale') {
      applyUiLocale(state, envelope.uiLocale)
    }
  })

  applyAppearanceToDocument(bootstrap.appearance)
  applyUiLocaleToDocument(bootstrap.uiLocale)
  postToEmbedder({ type: 'kisaki-webview:ready', webviewId: bootstrap.webviewId })

  return state
}

/** Mirrors the host UI locale onto the document `lang` attribute. */
function applyUiLocaleToDocument(uiLocale: UiLocale): void {
  document.documentElement.lang = uiLocale
}

function applyUiLocale(state: WebviewClientConnection, uiLocale: UiLocale): void {
  if (state.uiLocale === uiLocale) {
    return
  }

  state.uiLocale = uiLocale
  applyUiLocaleToDocument(uiLocale)
  for (const listener of uiLocaleListeners) {
    listener(uiLocale)
  }
}

/**
 * Applies a pushed appearance and notifies only the listener groups whose
 * slice actually changed, so a pure theme switch never wakes typography
 * listeners and vice versa.
 */
function applyAppearance(state: WebviewClientConnection, appearance: WebviewAppearance): void {
  const themeChanged = JSON.stringify(state.theme) !== JSON.stringify(appearance.theme)
  const typographyChanged =
    JSON.stringify(state.typography) !== JSON.stringify(appearance.typography)

  state.theme = appearance.theme
  state.typography = appearance.typography
  applyAppearanceToDocument(appearance)

  if (themeChanged) {
    for (const listener of themeListeners) {
      listener(appearance.theme)
    }
  }
  if (typographyChanged) {
    for (const listener of typographyListeners) {
      listener(appearance.typography)
    }
  }
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
  get typography(): WebviewTypography {
    return requireConnection().typography
  },
  get uiLocale(): UiLocale {
    return requireConnection().uiLocale
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
  onTypographyChange(listener: (typography: WebviewTypography) => void): Disposable {
    requireConnection()
    typographyListeners.add(listener)
    return {
      dispose() {
        typographyListeners.delete(listener)
      }
    }
  },
  onUiLocaleChange(listener: (uiLocale: UiLocale) => void): Disposable {
    requireConnection()
    uiLocaleListeners.add(listener)
    return {
      dispose() {
        uiLocaleListeners.delete(listener)
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

import type { ThemeTokenMap } from '../contributions/themes'
import type { Disposable, JsonObject, JsonValue } from '../shared'
import type { ValidationIssue } from '../shared/validation'
import { normalizeExtensionPackagePath } from '../manifest'
import { validateJsonObject } from '../shared/json'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../shared/validation'

export const WEBVIEW_DIALOG_SIZES = ['sm', 'md', 'lg', 'xl', 'full'] as const

export type WebviewDialogSize = (typeof WEBVIEW_DIALOG_SIZES)[number]

export const WEBVIEW_SURFACE_KINDS = ['dialog', 'page'] as const

export type WebviewSurfaceKind = (typeof WEBVIEW_SURFACE_KINDS)[number]

/**
 * Container the app uses to present a webview session.
 * @remarks `dialog` renders inside an app dialog with minimal chrome (title and
 * close button); `page` renders as a top-level routed page.
 */
export type WebviewSurface = { kind: 'dialog'; size?: WebviewDialogSize } | { kind: 'page' }

export interface WebviewOpenOptions {
  /**
   * HTML entry path relative to the manifest `ui` root, e.g. `settings/index.html`.
   */
  entry: string
  title: string
  surface: WebviewSurface
  /**
   * Open parameters delivered to the webview document at bootstrap.
   */
  params?: JsonObject
}

/**
 * One-way lifecycle handle for an open webview session: open -> closed.
 * @remarks Inbound messages are buffered until the first `onMessage` listener
 * registers, so attaching listeners after `open()` resolves never drops
 * messages. The handle cannot be reused after close.
 */
export interface WebviewHandle {
  readonly id: string
  /**
   * Aborts when the session closes, regardless of who closed it.
   */
  readonly signal: AbortSignal
  postMessage(message: JsonValue): Promise<void>
  onMessage(listener: (message: JsonValue) => void): Disposable
  onClose(listener: () => void): Disposable
  close(): Promise<void>
}

export interface WebviewsCapability {
  open(options: WebviewOpenOptions): Promise<WebviewHandle>
}

export type WebviewThemeMode = 'light' | 'dark'

/**
 * Resolved semantic theme tokens pushed into webview documents.
 */
export interface WebviewTheme {
  mode: WebviewThemeMode
  tokens: ThemeTokenMap
}

/**
 * Query parameter carrying the JSON-encoded {@link WebviewBootstrapPayload}
 * on the webview document URL.
 */
export const WEBVIEW_BOOTSTRAP_QUERY_PARAM = 'kisaki-webview'

/**
 * Bootstrap data the app embeds into the webview document URL so the webview
 * client is synchronously initialized at import time.
 */
export interface WebviewBootstrapPayload {
  webviewId: string
  extensionId: string
  params: JsonObject
  theme: WebviewTheme
}

/**
 * Window message envelope posted from the webview document to the app.
 */
export type WebviewClientMessage =
  | { type: 'kisaki-webview:ready'; webviewId: string }
  | { type: 'kisaki-webview:message'; webviewId: string; message: JsonValue }
  | { type: 'kisaki-webview:close'; webviewId: string }

/**
 * Window message envelope posted from the app to the webview document.
 */
export type WebviewEmbedderMessage =
  | { type: 'kisaki-webview:message'; message: JsonValue }
  | { type: 'kisaki-webview:theme'; theme: WebviewTheme }

/**
 * In-document API implemented by `@kisaki3/extension-sdk/webview`.
 */
export interface WebviewClient {
  readonly id: string
  readonly extensionId: string
  readonly params: JsonObject
  readonly theme: WebviewTheme
  onThemeChange(listener: (theme: WebviewTheme) => void): Disposable
  postMessage(message: JsonValue): void
  onMessage(listener: (message: JsonValue) => void): Disposable
  close(): void
}

const WEBVIEW_OPEN_OPTIONS_KEYS = new Set<string>(['entry', 'title', 'surface', 'params'])

const WEBVIEW_DIALOG_SURFACE_KEYS = new Set<string>(['kind', 'size'])

const WEBVIEW_PAGE_SURFACE_KEYS = new Set<string>(['kind'])

export function validateWebviewSurfaceShape(value: unknown, path = '$'): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: 'surface must be an object.' }]
  }

  if (value.kind === 'dialog') {
    return [
      ...validateUnknownKeys(value, WEBVIEW_DIALOG_SURFACE_KEYS, path),
      ...validateOptionalEnumString(
        value.size,
        `${path}.size`,
        WEBVIEW_DIALOG_SIZES,
        `size must be one of: ${WEBVIEW_DIALOG_SIZES.join(', ')}.`
      )
    ]
  }

  if (value.kind === 'page') {
    return validateUnknownKeys(value, WEBVIEW_PAGE_SURFACE_KEYS, path)
  }

  return [
    {
      path: `${path}.kind`,
      message: `kind must be one of: ${WEBVIEW_SURFACE_KINDS.join(', ')}.`
    }
  ]
}

export function validateWebviewOpenOptionsShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Webview open options must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, WEBVIEW_OPEN_OPTIONS_KEYS),
    ...validateRequiredString(value.entry, '$.entry', {
      trim: true,
      valueMessage: 'entry must be a non-empty string.'
    }),
    ...validateRequiredString(value.title, '$.title', {
      trim: true,
      valueMessage: 'title must be a non-empty string.'
    }),
    ...validateWebviewSurfaceShape(value.surface, '$.surface')
  ]

  if (typeof value.entry === 'string' && value.entry.length > 0) {
    const normalizedEntry = normalizeExtensionPackagePath(value.entry)
    if (!normalizedEntry) {
      issues.push({
        path: '$.entry',
        message: 'entry must be relative and stay inside the manifest ui root.'
      })
    } else if (!normalizedEntry.endsWith('.html')) {
      issues.push({
        path: '$.entry',
        message: 'entry must point to an .html document.'
      })
    }
  }

  if (value.params !== undefined) {
    issues.push(...validateJsonObject(value.params, '$.params'))
  }

  return issues
}

export function isWebviewOpenOptions(value: unknown): value is WebviewOpenOptions {
  return validateWebviewOpenOptionsShape(value).length === 0
}

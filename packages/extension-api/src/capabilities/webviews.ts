import type { Disposable, JsonObject, JsonValue } from '../shared'
import type { UiLocale } from '../shared/locales'
import type { ValidationIssue } from '../shared/validation'
import { normalizeExtensionPackagePath } from '../manifest'
import { validateJsonObject } from '../shared/json'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../shared/validation'

export const WEBVIEW_DIALOG_SIZES = ['sm', 'md', 'lg', 'xl', '2xl', 'full'] as const

export type WebviewDialogSize = (typeof WEBVIEW_DIALOG_SIZES)[number]

export const WEBVIEW_SURFACE_KINDS = ['dialog', 'page'] as const

export type WebviewSurfaceKind = (typeof WEBVIEW_SURFACE_KINDS)[number]

/**
 * Container the app uses to present a webview session.
 * @remarks Surfaces describe placement and sizing only — the app draws no
 * chrome inside them. The document owns its entire UI, including headers,
 * footers, and close affordances. `dialog` renders inside an app-owned modal
 * window (overlay, positioning, animation) that dismisses like app dialogs:
 * Esc closes, outside clicks do not. `page` renders as a top-level routed
 * page with the app navigation around it.
 */
export type WebviewSurface = { kind: 'dialog'; size?: WebviewDialogSize } | { kind: 'page' }

export interface WebviewOpenOptions {
  /**
   * HTML entry path relative to the manifest `ui` root, e.g. `settings/index.html`.
   */
  entry: string
  /**
   * Accessible session title, used for the frame's accessibility name and
   * session metadata. It is never rendered as visible chrome — the document
   * draws its own header if it wants one.
   */
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
 * Full resolved semantic token vocabulary mirrored into webview documents.
 * @remarks This is the webview *output* contract — the app resolves its active
 * theme (including derived tokens) and mirrors every value. It is deliberately
 * wider than the theme contribution *authoring* palette
 * ({@link import('../contributions/themes').THEME_TOKEN_NAMES}), which stays a
 * compact input from which the app derives the rest.
 */
export const WEBVIEW_THEME_TOKEN_NAMES = [
  'background',
  'foreground',
  'surface',
  'surfaceForeground',
  'popover',
  'popoverForeground',
  'dialog',
  'dialogForeground',
  'primary',
  'primaryForeground',
  'secondary',
  'secondaryForeground',
  'muted',
  'mutedForeground',
  'accent',
  'accentForeground',
  'input',
  'inputForeground',
  'destructive',
  'destructiveForeground',
  'info',
  'infoForeground',
  'success',
  'successForeground',
  'warning',
  'warningForeground',
  'border',
  'ring'
] as const

export type WebviewThemeTokenName = (typeof WEBVIEW_THEME_TOKEN_NAMES)[number]

export type WebviewThemeTokenMap = Record<WebviewThemeTokenName, string>

/**
 * Resolved theme state pushed into webview documents. The webview client
 * mirrors `tokens` as `--kisaki-<token>` CSS variables and `radius` as
 * `--kisaki-radius` on the document root.
 */
export interface WebviewTheme {
  mode: WebviewThemeMode
  tokens: WebviewThemeTokenMap
  /**
   * Resolved base corner radius, e.g. `6px`.
   */
  radius: string
  /**
   * Opacity of the app's translucent base panes ("glass"), e.g. `72%`.
   * Page-surface documents compose it over the raw background/surface tokens
   * so their base panes transmit the app light layers exactly like native
   * pages; dialog-surface documents stay opaque slabs and ignore it.
   */
  paneAlpha: string
}

/**
 * Resolved app typography mirrored into webview documents: the font faces,
 * the semantic family stacks, and the base text metrics. The app serves
 * unicode-range sliced font stylesheets with CORS enabled; the webview client
 * injects them as `<link>` elements and mirrors the rest as `--kisaki-font-*`
 * and `--kisaki-text-*` CSS variables on the document root.
 */
export interface WebviewTypography {
  /**
   * Absolute stylesheet URLs declaring the app font faces.
   */
  stylesheets: readonly string[]
  /**
   * Full CSS `font-family` stack for the sans slot, fallbacks included.
   */
  sans: string
  /**
   * Full CSS `font-family` stack for the mono slot, fallbacks included.
   */
  mono: string
  /**
   * Base `font-size`, e.g. `14px`. Anchors rem-based control metrics.
   */
  baseSize: string
  /**
   * Base `font-weight`, e.g. `450`.
   */
  baseWeight: string
  /**
   * Base `line-height`, e.g. `1.5`.
   */
  baseLineHeight: string
  /**
   * Base `letter-spacing`, e.g. `normal`.
   */
  baseLetterSpacing: string
}

/**
 * Full resolved appearance the app hands to a webview document: the color
 * theme and the typography. Delivered at bootstrap and re-pushed whenever the
 * app appearance changes.
 */
export interface WebviewAppearance {
  theme: WebviewTheme
  typography: WebviewTypography
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
  /**
   * Surface the document is embedded in, fixed for the session lifetime.
   * The webview client paints the document base to match the host surface:
   * `dialog` paints the opaque dialog slab, `page` paints the translucent
   * background glass pane over a transparent document canvas so the app
   * light layers transmit through the frame.
   */
  surface: WebviewSurfaceKind
  appearance: WebviewAppearance
  /** Host interface language at open time. Changes are pushed as `kisaki-webview:ui-locale`. */
  uiLocale: UiLocale
}

/**
 * Window message envelope posted from the webview document to the app.
 */
export type WebviewClientEnvelope =
  | { type: 'kisaki-webview:ready'; webviewId: string }
  | { type: 'kisaki-webview:message'; webviewId: string; message: JsonValue }
  | { type: 'kisaki-webview:close'; webviewId: string }

/**
 * Window message envelope posted from the app to the webview document.
 */
export type WebviewEmbedderEnvelope =
  | { type: 'kisaki-webview:message'; message: JsonValue }
  | { type: 'kisaki-webview:appearance'; appearance: WebviewAppearance }
  | { type: 'kisaki-webview:ui-locale'; uiLocale: UiLocale }

/**
 * In-document API implemented by `@kisaki3/extension-sdk/webview`.
 */
export interface WebviewClient {
  readonly id: string
  readonly extensionId: string
  readonly params: JsonObject
  /** Surface this document is embedded in, fixed for the session lifetime. */
  readonly surface: WebviewSurfaceKind
  readonly theme: WebviewTheme
  readonly typography: WebviewTypography
  readonly uiLocale: UiLocale
  onThemeChange(listener: (theme: WebviewTheme) => void): Disposable
  onTypographyChange(listener: (typography: WebviewTypography) => void): Disposable
  onUiLocaleChange(listener: (uiLocale: UiLocale) => void): Disposable
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

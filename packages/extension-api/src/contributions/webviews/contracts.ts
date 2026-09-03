import type { WebviewHandle } from '../../capabilities/webviews'
import type { ContributionIcon, Disposable, LocalizedText } from '../../shared'

/**
 * Dialog width steps, the app's own dialog scale. A step names the content
 * class (`sm` prompts, `md` forms, `lg` list editing, `xl` detail views and
 * tables, `2xl` editors); the host clamps it at small windows. Webview dialogs
 * always take a definite height, so a document can lay out against it.
 */
export const WEBVIEW_DIALOG_SIZES = ['sm', 'md', 'lg', 'xl', '2xl'] as const

export type WebviewDialogSize = (typeof WEBVIEW_DIALOG_SIZES)[number]

/**
 * Top-level navigation placement for a webview page. Presence opts the page
 * into the app sidebar; `order` sorts extension navigation entries.
 */
export interface WebviewPageNavPlacement {
  order?: number | undefined
}

/**
 * Declared routed page surface. The app owns presentation and lifetime: the
 * page renders as a top-level route with the app navigation around it, and
 * navigation entries derive from this declaration. Session wiring happens
 * through {@link WebviewPageRegistration.onOpen}, regardless of whether the
 * page was opened by a navigation click, `kisaki.webviews.openPage`, or a
 * deeplink.
 */
export interface WebviewPageContribution {
  id: string
  /** Localized page title; the renderer resolves it against the UI locale. */
  title: LocalizedText
  /**
   * HTML entry path relative to the manifest `ui` root, e.g.
   * `pages/sync/index.html`.
   */
  entry: string
  /** Chrome icon; required when `nav` is declared. */
  icon?: ContributionIcon | undefined
  /** Top-level navigation placement. Omit for programmatic-only pages. */
  nav?: WebviewPageNavPlacement | undefined
}

/**
 * Declared reusable dialog surface. The container (entry, title, size) is
 * declared once; any trigger opens it by id through
 * `kisaki.webviews.openDialog`, and session wiring happens once through
 * {@link WebviewDialogRegistration.onOpen}.
 */
export interface WebviewDialogContribution {
  id: string
  /** Localized accessible dialog title; never rendered as visible chrome. */
  title: LocalizedText
  /**
   * HTML entry path relative to the manifest `ui` root, e.g.
   * `dialogs/settings/index.html`.
   */
  entry: string
  size?: WebviewDialogSize | undefined
}

export interface WebviewPageRegistration extends Disposable {
  /**
   * Observes every session opened for this page, regardless of who opened it.
   */
  onOpen(listener: (webview: WebviewHandle) => void): Disposable
}

export interface WebviewDialogRegistration extends Disposable {
  /**
   * Observes every session opened for this dialog, regardless of who opened it.
   */
  onOpen(listener: (webview: WebviewHandle) => void): Disposable
}

export interface WebviewPageRegistrationPoint {
  register(page: WebviewPageContribution): WebviewPageRegistration
}

export interface WebviewDialogRegistrationPoint {
  register(dialog: WebviewDialogContribution): WebviewDialogRegistration
}

export interface WebviewRegistrar {
  readonly pages: WebviewPageRegistrationPoint
  readonly dialogs: WebviewDialogRegistrationPoint
}

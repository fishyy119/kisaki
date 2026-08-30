import {
  createValidationError,
  validateWebviewDialogContributionShape,
  validateWebviewPageContributionShape,
  type ExtensionRuntimeHandle,
  type WebviewDialogContribution,
  type WebviewPageContribution
} from '@kisaki3/extension-api'
import type { ExtensionIconInfo, ExtensionWebviewPageRegistrationInfo } from '@shared/extension'
import { resolveContributionIcon } from '../icon'
import {
  getRuntimeContributionKey,
  requireContributionOwner,
  toContributionOwnerInfo,
  type ExtensionContributionReleaseDiagnostic,
  type ExtensionContributionPointOptions,
  type RuntimeContributionOwner
} from '../types'

export interface ExtensionWebviewPageRegistration {
  owner: RuntimeContributionOwner
  page: WebviewPageContribution
  icon?: ExtensionIconInfo
}

export interface ExtensionWebviewDialogRegistration {
  owner: RuntimeContributionOwner
  dialog: WebviewDialogContribution
}

/**
 * Main-process registry of declared webview surfaces. Declarations are the
 * single source the webview session manager opens sessions from, and
 * nav-enabled pages project into the contribution snapshot for the renderer
 * sidebar.
 */
export class ExtensionWebviewContributionPoint {
  private readonly pages = new Map<string, ExtensionWebviewPageRegistration>()
  private readonly pagesByPublicId = new Map<string, ExtensionWebviewPageRegistration>()
  private readonly dialogs = new Map<string, ExtensionWebviewDialogRegistration>()
  private readonly dialogsByPublicId = new Map<string, ExtensionWebviewDialogRegistration>()

  constructor(private readonly options: ExtensionContributionPointOptions) {}

  registerPage(runtimeHandle: ExtensionRuntimeHandle, page: WebviewPageContribution): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    throwOnIssues('Webview page contribution', validateWebviewPageContributionShape(page))

    const publicKey = getPublicSurfaceKey(owner.extension.id, page.id)
    if (this.pagesByPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered webview page "${page.id}".`
      )
    }

    const registration: ExtensionWebviewPageRegistration = {
      owner,
      page,
      // Resolving at registration surfaces confinement violations immediately.
      ...(page.icon === undefined
        ? {}
        : { icon: resolveContributionIcon(owner.extension.id, page.icon) })
    }
    this.pages.set(getRuntimeContributionKey(runtimeHandle, page.id), registration)
    this.pagesByPublicId.set(publicKey, registration)
  }

  unregisterPage(runtimeHandle: ExtensionRuntimeHandle, pageId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, pageId)
    const registration = this.pages.get(key)
    if (!registration) {
      return
    }

    this.pages.delete(key)
    this.pagesByPublicId.delete(getPublicSurfaceKey(registration.owner.extension.id, pageId))
  }

  registerDialog(runtimeHandle: ExtensionRuntimeHandle, dialog: WebviewDialogContribution): void {
    const owner = requireContributionOwner(this.options, runtimeHandle)
    throwOnIssues('Webview dialog contribution', validateWebviewDialogContributionShape(dialog))

    const publicKey = getPublicSurfaceKey(owner.extension.id, dialog.id)
    if (this.dialogsByPublicId.has(publicKey)) {
      throw new Error(
        `Extension "${owner.extension.id}" already registered webview dialog "${dialog.id}".`
      )
    }

    const registration: ExtensionWebviewDialogRegistration = { owner, dialog }
    this.dialogs.set(getRuntimeContributionKey(runtimeHandle, dialog.id), registration)
    this.dialogsByPublicId.set(publicKey, registration)
  }

  unregisterDialog(runtimeHandle: ExtensionRuntimeHandle, dialogId: string): void {
    const key = getRuntimeContributionKey(runtimeHandle, dialogId)
    const registration = this.dialogs.get(key)
    if (!registration) {
      return
    }

    this.dialogs.delete(key)
    this.dialogsByPublicId.delete(getPublicSurfaceKey(registration.owner.extension.id, dialogId))
  }

  getPage(
    runtimeHandle: ExtensionRuntimeHandle,
    pageId: string
  ): ExtensionWebviewPageRegistration | null {
    return this.pages.get(getRuntimeContributionKey(runtimeHandle, pageId)) ?? null
  }

  getDialog(
    runtimeHandle: ExtensionRuntimeHandle,
    dialogId: string
  ): ExtensionWebviewDialogRegistration | null {
    return this.dialogs.get(getRuntimeContributionKey(runtimeHandle, dialogId)) ?? null
  }

  getPageByExtension(extensionId: string, pageId: string): ExtensionWebviewPageRegistration | null {
    return this.pagesByPublicId.get(getPublicSurfaceKey(extensionId, pageId)) ?? null
  }

  releaseRuntime(runtimeHandle: ExtensionRuntimeHandle): void {
    for (const [key, registration] of [...this.pages]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.pages.delete(key)
        this.pagesByPublicId.delete(
          getPublicSurfaceKey(registration.owner.extension.id, registration.page.id)
        )
      }
    }
    for (const [key, registration] of [...this.dialogs]) {
      if (registration.owner.runtimeHandle === runtimeHandle) {
        this.dialogs.delete(key)
        this.dialogsByPublicId.delete(
          getPublicSurfaceKey(registration.owner.extension.id, registration.dialog.id)
        )
      }
    }
  }

  releaseAll(): void {
    this.pages.clear()
    this.pagesByPublicId.clear()
    this.dialogs.clear()
    this.dialogsByPublicId.clear()
  }

  getSnapshot(): readonly ExtensionWebviewPageRegistrationInfo[] {
    return [...this.pages.values()]
      .map((registration) => ({
        ...toContributionOwnerInfo(registration.owner),
        pageId: registration.page.id,
        title: registration.page.title,
        ...(registration.icon === undefined ? {} : { icon: registration.icon }),
        ...(registration.page.nav === undefined
          ? {}
          : { nav: { order: registration.page.nav.order ?? 0 } })
      }))
      .sort(
        (left, right) =>
          (left.nav?.order ?? 0) - (right.nav?.order ?? 0) ||
          left.extensionId.localeCompare(right.extensionId) ||
          left.pageId.localeCompare(right.pageId)
      )
  }

  getReleaseDiagnostics(extensionId: string): readonly ExtensionContributionReleaseDiagnostic[] {
    return [
      ...[...this.pages.values()]
        .filter((registration) => registration.owner.extension.id === extensionId)
        .map((registration) => ({
          domain: 'webview pages',
          detail: registration.page.id
        })),
      ...[...this.dialogs.values()]
        .filter((registration) => registration.owner.extension.id === extensionId)
        .map((registration) => ({
          domain: 'webview dialogs',
          detail: registration.dialog.id
        }))
    ]
  }
}

function getPublicSurfaceKey(extensionId: string, surfaceId: string): string {
  return `${extensionId}:${surfaceId}`
}

function throwOnIssues(label: string, issues: readonly { path: string; message: string }[]): void {
  if (issues.length === 0) {
    return
  }

  throw createValidationError(
    `${label} is invalid:\n${issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')}`
  )
}

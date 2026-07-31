import {
  type WebviewDialogContribution,
  type WebviewDialogRegistration,
  type WebviewHandle,
  type WebviewOpenedEvent,
  type WebviewPageContribution,
  type WebviewPageRegistration,
  validateWebviewDialogContributionShape,
  validateWebviewPageContributionShape
} from '@kisaki3/extension-api'
import type { LoadedExtensionRuntime, RegisteredWebviewSurface } from '../../extension-registry'
import { requireRuntimeByScope, throwValidationIssues } from '../shared'
import type { HostContributionDomainOptions, HostContributionScope } from '../types'
import { createContributionRegistration } from '../registration'

export interface HostWebviewContributionPointOptions extends HostContributionDomainOptions {
  /** Builds the author-facing session handle for `onOpen` dispatch. */
  createWebviewHandle(scope: HostContributionScope, webviewId: string): WebviewHandle
}

/**
 * Host-side declarative webview contribution domain. Declarations are pure
 * data synchronized to the main registry; `onOpen` listeners stay in the host
 * and receive a session handle whenever main reports a session opened for the
 * declared page or dialog, regardless of what triggered the open.
 */
export class HostWebviewContributionPoint {
  constructor(private readonly options: HostWebviewContributionPointOptions) {}

  registerPage(
    scope: HostContributionScope,
    page: WebviewPageContribution
  ): WebviewPageRegistration {
    const issues = validateWebviewPageContributionShape(page)
    if (issues.length > 0) {
      throwValidationIssues('Webview page contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.webviewPages.has(page.id)) {
      throw new Error(`Webview page "${page.id}" is already registered by "${scope.extensionId}".`)
    }

    const registered = this.options.registry.registerWebviewPage(scope.extensionId, page)
    const request = this.options.rpc.requestMain(
      'contributions.webviews.registerPage',
      {
        runtimeHandle: scope.runtimeHandle,
        page
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Webview page contribution "${page.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.options.registry.unregisterWebviewPage(scope.extensionId, page.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.webviews.unregisterPage',
          {
            runtimeHandle: scope.runtimeHandle,
            pageId: page.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.options.registry.unregisterWebviewPage(scope.extensionId, page.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Webview page contribution "${page.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)

    return {
      dispose: () => registration.dispose(),
      onOpen: (listener) => {
        registration.assertActive('observe sessions')
        registered.openListeners.add(listener)
        return {
          dispose: () => {
            registered.openListeners.delete(listener)
          }
        }
      }
    }
  }

  registerDialog(
    scope: HostContributionScope,
    dialog: WebviewDialogContribution
  ): WebviewDialogRegistration {
    const issues = validateWebviewDialogContributionShape(dialog)
    if (issues.length > 0) {
      throwValidationIssues('Webview dialog contribution', issues)
    }

    const runtime = requireRuntimeByScope(this.options.registry, scope)
    if (runtime.webviewDialogs.has(dialog.id)) {
      throw new Error(
        `Webview dialog "${dialog.id}" is already registered by "${scope.extensionId}".`
      )
    }

    const registered = this.options.registry.registerWebviewDialog(scope.extensionId, dialog)
    const request = this.options.rpc.requestMain(
      'contributions.webviews.registerDialog',
      {
        runtimeHandle: scope.runtimeHandle,
        dialog
      },
      this.options.getRequestOptions(scope)
    )

    const registration = createContributionRegistration({
      scope,
      label: `Webview dialog contribution "${dialog.id}"`,
      mainRegistration: request,
      reportDiagnostic: (diagnostic) => this.options.reportDiagnostic(scope, diagnostic),
      disposeLocal: () => {
        this.options.registry.unregisterWebviewDialog(scope.extensionId, dialog.id)
      },
      unregisterMain: () =>
        this.options.rpc.requestMain(
          'contributions.webviews.unregisterDialog',
          {
            runtimeHandle: scope.runtimeHandle,
            dialogId: dialog.id
          },
          this.options.getCleanupRequestOptions(scope)
        ),
      invalidateLocal: () => {
        this.options.registry.unregisterWebviewDialog(scope.extensionId, dialog.id)
      },
      onSyncFailure: (error) => {
        runtime.context.logger.error(
          `Webview dialog contribution "${dialog.id}" was disabled because main registry synchronization failed.`,
          error
        )
      }
    })
    this.options.trackMainRequest(scope, registration.sync)

    return {
      dispose: () => registration.dispose(),
      onOpen: (listener) => {
        registration.assertActive('observe sessions')
        registered.openListeners.add(listener)
        return {
          dispose: () => {
            registered.openListeners.delete(listener)
          }
        }
      }
    }
  }

  async handleOpened(payload: WebviewOpenedEvent): Promise<void> {
    const runtime = this.options.registry.getByRuntimeHandle(payload.runtimeHandle)
    if (!runtime) {
      return
    }

    const registered = findRegisteredSurface(runtime, payload)
    if (!registered || registered.openListeners.size === 0) {
      return
    }

    const scope: HostContributionScope = {
      extensionId: runtime.metadata.id,
      runtimeHandle: payload.runtimeHandle
    }
    const handle = this.options.createWebviewHandle(scope, payload.webviewId)

    for (const listener of [...registered.openListeners]) {
      try {
        await this.options.runInExtensionContext(scope, () => Promise.resolve(listener(handle)))
      } catch (error) {
        console.warn(`[ExtensionHost][${scope.extensionId}] Webview open listener failed:`, error)
      }
    }
  }

  releaseRuntime(runtimeHandle: string): void {
    const runtime = this.options.registry.getByRuntimeHandle(runtimeHandle)
    runtime?.webviewPages.clear()
    runtime?.webviewDialogs.clear()
  }

  releaseAll(): void {
    for (const runtime of this.options.registry.list()) {
      runtime.webviewPages.clear()
      runtime.webviewDialogs.clear()
    }
  }
}

function findRegisteredSurface(
  runtime: LoadedExtensionRuntime,
  payload: WebviewOpenedEvent
): RegisteredWebviewSurface<unknown> | undefined {
  return payload.surface.kind === 'page'
    ? runtime.webviewPages.get(payload.surface.pageId)
    : runtime.webviewDialogs.get(payload.surface.dialogId)
}

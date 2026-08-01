import {
  createUnavailableError,
  createValidationError,
  validateWebviewOpenOptionsShape,
  type ExtensionRuntimeMetadata,
  type JsonObject,
  type JsonValue,
  type WebviewOpenOptions
} from '@kisaki3/extension-api'
import type { ExtensionWebviewSessionManager } from '../webviews'

export interface ExtensionWebviewsCapabilityProviderOptions {
  sessions: ExtensionWebviewSessionManager
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

/**
 * Stateless adapter for the extension-facing `kisaki.webviews` capability.
 * Authenticates the runtime handle, validates open options at the untrusted
 * boundary, and forwards to the webview session manager that owns live
 * sessions.
 */
export class ExtensionWebviewsCapabilityProvider {
  constructor(private readonly options: ExtensionWebviewsCapabilityProviderOptions) {}

  openPage(
    runtimeHandle: string,
    pageId: string,
    options?: WebviewOpenOptions
  ): { webviewId: string } {
    const metadata = this.requireRuntime(runtimeHandle)
    const params = this.requireOpenParams(options)
    return this.options.sessions.openPage(runtimeHandle, metadata.id, pageId, params)
  }

  openDialog(
    runtimeHandle: string,
    dialogId: string,
    options?: WebviewOpenOptions
  ): { webviewId: string } {
    const metadata = this.requireRuntime(runtimeHandle)
    const params = this.requireOpenParams(options)
    return this.options.sessions.openDialog(runtimeHandle, metadata.id, dialogId, params)
  }

  close(runtimeHandle: string, webviewId: string): void {
    this.options.sessions.close(runtimeHandle, webviewId)
  }

  postMessage(runtimeHandle: string, webviewId: string, message: JsonValue): void {
    this.options.sessions.postMessageToWebview(runtimeHandle, webviewId, message)
  }

  private requireOpenParams(options: WebviewOpenOptions | undefined): JsonObject {
    const issues = validateWebviewOpenOptionsShape(options)
    if (issues.length > 0) {
      throw createValidationError(
        `Webview open options are invalid:\n${issues
          .map((issue) => `${issue.path}: ${issue.message}`)
          .join('\n')}`
      )
    }

    return options?.params ?? {}
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

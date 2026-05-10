/**
 * Auth Handler
 *
 * Handles kisaki://auth/* deeplinks for OAuth callbacks.
 *
 * Supported URLs:
 * - kisaki://auth/callback?provider={provider}&code={code}&state={state}
 * - kisaki://auth/callback?provider={provider}&error={error}&error_description={desc}
 */

import log from 'electron-log/main'
import type { DeeplinkResult, DeeplinkRouteContext, DeeplinkRouteHandler } from '../types'
import type { IpcService } from '@main/services/ipc'
import type { WindowService } from '@main/services/window'

export const AUTH_DEEPLINK_ROUTE = '/auth/callback' as const

interface AuthCallbackQuery {
  provider: string
  code?: string
  state?: string
  error?: string
  errorDescription?: string
}

type AuthDeeplinkContext = DeeplinkRouteContext<typeof AUTH_DEEPLINK_ROUTE>

export class AuthHandler implements DeeplinkRouteHandler<typeof AUTH_DEEPLINK_ROUTE> {
  constructor(
    private readonly ipc: IpcService,
    private readonly windowService: WindowService
  ) {}

  async handle(deeplink: AuthDeeplinkContext): Promise<DeeplinkResult> {
    return this.handleCallback(deeplink)
  }

  private async handleCallback(deeplink: AuthDeeplinkContext): Promise<DeeplinkResult> {
    const query = parseAuthCallbackQuery(deeplink.query)

    if (!query.provider) {
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: 'Provider is required'
      }
    }

    // Handle error callback
    if (query.error) {
      log.warn(`[AuthHandler] Auth error from ${query.provider}: ${query.error}`)

      // Send error event to renderer
      this.ipc.send('deeplink:auth-error', {
        provider: query.provider,
        error: query.error,
        errorDescription: query.errorDescription
      })

      // Focus window to show error
      this.focusMainWindow()

      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: query.errorDescription || query.error,
        data: { provider: query.provider, error: query.error }
      }
    }

    // Validate code
    if (!query.code) {
      return {
        success: false,
        path: deeplink.path,
        pattern: deeplink.pattern,
        message: 'Authorization code is required'
      }
    }

    log.info(`[AuthHandler] Auth callback received from ${query.provider}`)

    // Send callback event to renderer for processing
    this.ipc.send('deeplink:auth-callback', {
      provider: query.provider,
      code: query.code,
      state: query.state
    })

    // Focus window
    this.focusMainWindow()

    return {
      success: true,
      path: deeplink.path,
      pattern: deeplink.pattern,
      message: `Auth callback received from ${query.provider}`,
      data: { provider: query.provider, hasCode: true, state: query.state }
    }
  }

  private focusMainWindow(): void {
    try {
      const mainWindow = this.windowService.getMainWindow()
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    } catch (error) {
      log.error('[AuthHandler] Error focusing main window:', error)
    }
  }
}

function parseAuthCallbackQuery(query: Record<string, string>): Partial<AuthCallbackQuery> {
  return {
    provider: query.provider,
    code: query.code,
    state: query.state,
    error: query.error,
    errorDescription: query.error_description
  }
}

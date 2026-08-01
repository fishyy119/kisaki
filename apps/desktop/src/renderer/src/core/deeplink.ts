/**
 * Deeplink Handler
 *
 * Handles deeplink events from the main process in the renderer.
 */

import type { Router } from 'vue-router'
import { ipcManager } from './ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Deeplink')

/**
 * Setup deeplink event handlers.
 * Should be called during app initialization; the app entry injects the
 * router so this module stays free of a static dependency on the singleton.
 */
export function setupDeeplinkHandlers(router: Router): void {
  // Handle navigation events
  ipcManager.on('deeplink:navigate', (_, { route, query }) => {
    log.info('Navigating to route.', { route })
    router.push({ path: route, query })
  })

  // Handle auth callback events
  ipcManager.on('deeplink:auth-callback', (_, { provider, code, state }) => {
    log.info('Auth callback received.', { provider })
    // Emit a custom event that auth-related components can listen to
    window.dispatchEvent(
      new CustomEvent('kisaki:auth-callback', {
        detail: { provider, code, state }
      })
    )
  })

  // Handle auth error events
  ipcManager.on('deeplink:auth-error', (_, { provider, error, errorDescription }) => {
    log.error('Auth callback failed.', { provider, error })
    // Emit a custom event that auth-related components can listen to
    window.dispatchEvent(
      new CustomEvent('kisaki:auth-error', {
        detail: { provider, error, errorDescription }
      })
    )
  })

  log.info('Handlers initialized')
}

/**
 * Trigger a deeplink from the renderer process.
 * Useful for testing or programmatic deeplink handling.
 */
export async function handleDeeplink(url: string): Promise<boolean> {
  const result = await ipcManager.invoke('deeplink:handle', url)
  if (result.success) {
    return result.data.success
  }
  return false
}

/**
 * Get all registered deeplink route patterns.
 */
export async function getDeeplinkRoutes(): Promise<string[]> {
  const result = await ipcManager.invoke('deeplink:list-routes')
  if (result.success) {
    return result.data.map((route) => route.pattern)
  }
  return []
}

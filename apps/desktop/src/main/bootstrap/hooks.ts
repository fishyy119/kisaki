/**
 * App bootstrap hooks.
 *
 * Owned by the bootstrap sequence in main/index.ts rather than a service:
 * they mark app-level lifecycle boundaries that exist outside any single
 * service's lifetime.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'

/** Total budget for awaiting appShuttingDown taps before disposal proceeds. */
export const APP_SHUTDOWN_SETTLE_BUDGET_MS = 3_000

export interface BootstrapHooks {
  /** Fires once all services are initialized and the main window exists. */
  appReady: NotifyHook<void>
  /**
   * Awaited (with a total budget) before services are disposed, while the
   * extension host is still alive, so subscribers can flush state.
   */
  appShuttingDown: NotifyHook<void>
}

export const bootstrapHooks: BootstrapHooks = {
  appReady: createNotifyHook<void>('app.ready'),
  appShuttingDown: createNotifyHook<void>('app.shutting-down')
}

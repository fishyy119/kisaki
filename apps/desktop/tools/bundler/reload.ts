/** Reload actions the dev workflow can apply, ordered by increasing strength. */
export type DevReloadAction = 'reload-renderer' | 'restart-app'

export interface DevReloadCoordinatorOptions {
  /** True while any watch build has an unsettled cycle. */
  isBuildInProgress(): boolean
  apply(action: DevReloadAction): void
  settleDelayMs?: number
}

/**
 * Coalesces reload signals from the main and preload watch builds so one file
 * change (typically in src/shared) produces one visible action. Signals inside
 * the settle window merge to the strongest action, and flushing is held while
 * any watcher is mid-cycle: a pending renderer reload must not fire when the
 * same change is about to restart Electron anyway.
 */
export class DevReloadCoordinator {
  private pendingAction: DevReloadAction | null = null
  private settleTimer: NodeJS.Timeout | null = null

  constructor(private readonly options: DevReloadCoordinatorOptions) {}

  schedule(action: DevReloadAction): void {
    if (this.pendingAction !== 'restart-app') {
      this.pendingAction = action
    }

    this.armSettleTimer()
  }

  /** Reports a settled watch cycle so a held flush can retry. */
  notifyBuildSettled(): void {
    if (this.pendingAction && !this.settleTimer) {
      this.armSettleTimer()
    }
  }

  dispose(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer)
      this.settleTimer = null
    }

    this.pendingAction = null
  }

  private armSettleTimer(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer)
    }

    this.settleTimer = setTimeout(() => {
      this.settleTimer = null
      this.flush()
    }, this.options.settleDelayMs ?? 150)
  }

  private flush(): void {
    if (!this.pendingAction) {
      return
    }

    // Held: the in-flight cycle retries through notifyBuildSettled, either
    // upgrading the pending action (main rebuilt) or releasing it (build
    // failed and no restart is coming).
    if (this.options.isBuildInProgress()) {
      return
    }

    const action = this.pendingAction
    this.pendingAction = null
    this.options.apply(action)
  }
}

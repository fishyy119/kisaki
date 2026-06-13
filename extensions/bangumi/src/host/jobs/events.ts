import type { Disposable } from '@kisaki3/extension-sdk'

/**
 * In-process lifecycle events for Bangumi command jobs. The settings webview
 * refreshes from these instead of polling for active runs.
 */
export interface BangumiJobEvent {
  type: 'started' | 'finished'
  commandId: string
}

export class BangumiJobEvents {
  private readonly listeners = new Set<(event: BangumiJobEvent) => void>()

  subscribe(listener: (event: BangumiJobEvent) => void): Disposable {
    this.listeners.add(listener)
    return {
      dispose: () => {
        this.listeners.delete(listener)
      }
    }
  }

  emit(event: BangumiJobEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event)
      } catch {
        // Listener failures must never break the job itself.
      }
    }
  }
}

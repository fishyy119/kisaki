/**
 * Serial runner: one run in flight, at most one trailing rerun.
 *
 * Every request while a run is in flight folds into a single rerun after it,
 * so a burst of invalidations costs at most one extra round trip. A request
 * that supersedes aborts the in-flight run first, so a result computed from
 * outdated inputs never lands; `run` checks its signal before applying.
 */

export interface SerialRunner {
  /** Request a run; returns the promise of the whole chain. */
  request: (options?: { supersede?: boolean }) => Promise<void>
  /** Abort the in-flight run and drop any trailing request. */
  abort: () => void
  /** Whether a run is in flight or queued. */
  readonly inFlight: boolean
}

export interface SerialRunnerOptions {
  run: (signal: AbortSignal) => Promise<void>
  /** Called once the chain drains: nothing in flight, nothing queued. */
  onIdle?: () => void
}

export function createSerialRunner({ run, onIdle }: SerialRunnerOptions): SerialRunner {
  let controller: AbortController | null = null
  let chain: Promise<void> | null = null
  let trailing = false

  function request({ supersede = false }: { supersede?: boolean } = {}): Promise<void> {
    if (chain) {
      if (supersede) controller?.abort()
      trailing = true
      return chain
    }

    chain = (async () => {
      try {
        do {
          trailing = false
          controller = new AbortController()
          await run(controller.signal)
        } while (trailing)
      } finally {
        controller = null
        chain = null
        onIdle?.()
      }
    })()

    return chain
  }

  function abort(): void {
    trailing = false
    controller?.abort()
  }

  return {
    request,
    abort,
    get inFlight() {
      return chain !== null
    }
  }
}

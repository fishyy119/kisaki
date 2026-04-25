import type { Disposable, DisposableStore } from '@kisaki/extension-api'

class DisposableStoreImpl implements DisposableStore {
  private readonly disposables = new Set<Disposable>()

  get size(): number {
    return this.disposables.size
  }

  add<T extends Disposable>(disposable: T): T {
    this.disposables.add(disposable)
    return disposable
  }

  delete(disposable: Disposable): boolean {
    return this.disposables.delete(disposable)
  }

  async clear(): Promise<void> {
    const disposables = [...this.disposables]
    this.disposables.clear()
    const errors: unknown[] = []

    for (const disposable of disposables.reverse()) {
      try {
        await disposable.dispose()
      } catch (error) {
        errors.push(error)
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors, 'One or more extension disposables failed to clean up.')
    }
  }

  async dispose(): Promise<void> {
    await this.clear()
  }
}

/**
 * Creates a LIFO disposable store for an extension runtime.
 */
export function createDisposableStore(): DisposableStore {
  return new DisposableStoreImpl()
}

/**
 * Wraps a cleanup callback in the SDK disposable contract.
 */
export function createDisposable(dispose: () => Promise<void> | void): Disposable {
  return { dispose }
}

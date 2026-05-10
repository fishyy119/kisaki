import type { Disposable } from '@kisaki/extension-api'
import type { HostContributionDiagnosticInput, HostContributionScope } from './types'

type ContributionRegistrationStatus = 'active' | 'invalidated' | 'disposed'

export interface HostContributionRegistrationOptions {
  scope: HostContributionScope
  label: string
  mainRegistration: Promise<unknown>
  disposeLocal(): Promise<unknown> | unknown
  unregisterMain(): Promise<unknown> | unknown
  invalidateLocal(error: unknown): Promise<unknown> | unknown
  reportDiagnostic?(diagnostic: HostContributionDiagnosticInput): void
  onSyncFailure?(error: unknown): void
}

export interface HostContributionRegistrationController extends Disposable {
  readonly sync: Promise<void>
  assertActive(operation: string): void
}

export function createContributionRegistration(
  options: HostContributionRegistrationOptions
): HostContributionRegistrationController {
  return new HostContributionRegistration(options)
}

class HostContributionRegistration implements HostContributionRegistrationController {
  private status: ContributionRegistrationStatus = 'active'
  private mainRegistered = false
  private disposePromise: Promise<void> | null = null

  readonly sync: Promise<void>

  constructor(private readonly options: HostContributionRegistrationOptions) {
    this.sync = Promise.resolve(options.mainRegistration).then(
      () => {
        this.mainRegistered = true
      },
      async (error) => {
        await this.invalidate(error)
      }
    )
  }

  async dispose(): Promise<void> {
    if (this.disposePromise) {
      return this.disposePromise
    }

    this.disposePromise = this.disposeOnce()
    return this.disposePromise
  }

  assertActive(operation: string): void {
    if (this.status === 'active') {
      return
    }

    throw new Error(`${this.options.label} cannot ${operation} because it has been ${this.status}.`)
  }

  private async disposeOnce(): Promise<void> {
    if (this.status === 'disposed') {
      return
    }

    const shouldDisposeLocal = this.status === 'active'
    this.status = 'disposed'
    const errors: unknown[] = []

    if (shouldDisposeLocal) {
      try {
        await this.options.disposeLocal()
      } catch (error) {
        errors.push(error)
      }
    }

    await this.sync

    if (this.mainRegistered) {
      try {
        await this.options.unregisterMain()
      } catch (error) {
        errors.push(error)
      }
    }

    if (errors.length === 0) {
      return
    }

    if (errors.length === 1) {
      throw errors[0]
    }

    throw new AggregateError(errors, `Failed to dispose ${this.options.label}.`)
  }

  private async invalidate(error: unknown): Promise<void> {
    if (this.status !== 'active') {
      return
    }

    this.status = 'invalidated'

    try {
      await this.options.invalidateLocal(error)
    } catch (rollbackError) {
      console.warn(
        `[ExtensionHost][${this.options.scope.extensionId}] Failed to roll back ${this.options.label} after main synchronization failed:`,
        rollbackError
      )
    }

    try {
      this.options.reportDiagnostic?.({
        severity: 'error',
        source: 'extension.contributions',
        code: 'contribution_sync_failed',
        message: `${this.options.label} was disabled because main registry synchronization failed.`,
        details: formatDiagnosticDetails(error)
      })
    } catch (diagnosticError) {
      console.warn(
        `[ExtensionHost][${this.options.scope.extensionId}] Failed to report ${this.options.label} diagnostic:`,
        diagnosticError
      )
    }

    try {
      this.options.onSyncFailure?.(error)
    } catch (logError) {
      console.warn(
        `[ExtensionHost][${this.options.scope.extensionId}] Failed to report ${this.options.label} synchronization failure:`,
        logError
      )
    }
  }
}

function formatDiagnosticDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  try {
    return JSON.stringify(error) ?? String(error)
  } catch {
    return 'Unknown synchronization error'
  }
}

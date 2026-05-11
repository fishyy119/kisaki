export type ExtensionPackageOperationKind = 'install' | 'update' | 'uninstall' | 'local-import'

export type ExtensionPackageOperationPhase =
  | 'queued'
  | 'waiting-lock'
  | 'download'
  | 'verify'
  | 'extract'
  | 'commit'
  | 'finished'

export interface ExtensionPackageOperationRecord {
  readonly operationId: string
  readonly kind: ExtensionPackageOperationKind
  readonly extensionId?: string
  readonly startedAt: Date
  readonly controller: AbortController
  phase: ExtensionPackageOperationPhase
  cancelRequested: boolean
}

export interface StartExtensionPackageOperationInput {
  operationId: string
  kind: ExtensionPackageOperationKind
  extensionId?: string
}

/**
 * Tracks in-flight package operations in memory. Cancellation is intentionally
 * process-local; startup recovery is driven by filesystem + DB state instead.
 */
export class ExtensionPackageOperationRegistry {
  private readonly operations = new Map<string, ExtensionPackageOperationRecord>()

  start(input: StartExtensionPackageOperationInput): ExtensionPackageOperationRecord {
    if (this.operations.has(input.operationId)) {
      throw new Error(`Extension package operation "${input.operationId}" is already running.`)
    }

    const record: ExtensionPackageOperationRecord = {
      operationId: input.operationId,
      kind: input.kind,
      extensionId: input.extensionId,
      startedAt: new Date(),
      controller: new AbortController(),
      phase: 'queued',
      cancelRequested: false
    }
    this.operations.set(input.operationId, record)
    return record
  }

  get(operationId: string): ExtensionPackageOperationRecord | null {
    return this.operations.get(operationId) ?? null
  }

  list(): readonly ExtensionPackageOperationRecord[] {
    return [...this.operations.values()]
  }

  setPhase(operationId: string, phase: ExtensionPackageOperationPhase): void {
    const record = this.require(operationId)
    record.phase = phase
  }

  cancel(operationId: string): boolean {
    const record = this.operations.get(operationId)
    if (!record) {
      return false
    }

    record.cancelRequested = true
    if (isCancellablePhase(record.phase)) {
      record.controller.abort()
      return true
    }

    return false
  }

  finish(operationId: string): void {
    const record = this.operations.get(operationId)
    if (record) {
      record.phase = 'finished'
      this.operations.delete(operationId)
    }
  }

  async run<T>(
    input: StartExtensionPackageOperationInput,
    operation: (record: ExtensionPackageOperationRecord) => Promise<T>
  ): Promise<T> {
    const record = this.start(input)
    try {
      return await operation(record)
    } finally {
      this.finish(record.operationId)
    }
  }

  require(operationId: string): ExtensionPackageOperationRecord {
    const record = this.operations.get(operationId)
    if (!record) {
      throw new Error(`Extension package operation "${operationId}" is not running.`)
    }
    return record
  }
}

export function isCancellablePhase(phase: ExtensionPackageOperationPhase): boolean {
  return (
    phase === 'queued' ||
    phase === 'waiting-lock' ||
    phase === 'download' ||
    phase === 'verify' ||
    phase === 'extract'
  )
}

export function assertExtensionPackageOperationNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Extension package operation was cancelled.')
    error.name = 'AbortError'
    throw error
  }
}

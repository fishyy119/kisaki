export type ExtensionPackageSourceKind = 'repository' | 'local-file'

export type ExtensionPackageStage = 'download' | 'verify' | 'extract' | 'commit' | 'recover'

export interface ExtensionPackageDiagnostic {
  stage: ExtensionPackageStage
  message: string
  path?: string
}

export class ExtensionPackageError extends Error {
  readonly diagnostics: readonly ExtensionPackageDiagnostic[]
  override readonly cause?: unknown

  constructor(
    diagnostic: ExtensionPackageDiagnostic,
    options: { cause?: unknown; diagnostics?: readonly ExtensionPackageDiagnostic[] } = {}
  ) {
    super(diagnostic.message)
    this.name = 'ExtensionPackageError'
    this.cause = options.cause
    this.diagnostics = options.diagnostics ?? [diagnostic]
  }
}

export function createExtensionPackageError(
  diagnostic: ExtensionPackageDiagnostic,
  cause?: unknown
): ExtensionPackageError {
  const causeMessage = getErrorMessage(cause)
  const message = causeMessage ? `${diagnostic.message}: ${causeMessage}` : diagnostic.message

  return new ExtensionPackageError(
    {
      ...diagnostic,
      message
    },
    { cause }
  )
}

export function wrapExtensionPackageError(
  error: unknown,
  diagnostic: ExtensionPackageDiagnostic
): ExtensionPackageError {
  if (error instanceof ExtensionPackageError) {
    return error
  }

  return createExtensionPackageError(diagnostic, error)
}

function getErrorMessage(error: unknown): string | null {
  if (error === undefined || error === null) {
    return null
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

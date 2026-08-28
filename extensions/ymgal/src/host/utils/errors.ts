export type YmgalErrorCode =
  | 'auth_failed'
  | 'credential_required'
  | 'ymgal_not_found'
  | 'ymgal_rate_limited'
  | 'ymgal_rejected'
  | 'network_failed'
  | 'archive_id_invalid'

export class YmgalExtensionError extends Error {
  constructor(
    public readonly code: YmgalErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'YmgalExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof YmgalExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

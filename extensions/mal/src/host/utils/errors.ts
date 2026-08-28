export type MalErrorCode =
  | 'auth_required'
  | 'auth_expired'
  | 'auth_cancelled'
  | 'mal_not_found'
  | 'mal_rate_limited'
  | 'mal_rejected'
  | 'mirror_unavailable'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'operation_running'

export class MalExtensionError extends Error {
  constructor(
    public readonly code: MalErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'MalExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof MalExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

export type NeodbErrorCode =
  | 'auth_required'
  | 'auth_rejected'
  | 'auth_cancelled'
  | 'registration_failed'
  | 'neodb_not_found'
  | 'neodb_rate_limited'
  | 'neodb_rejected'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'operation_running'

export class NeodbExtensionError extends Error {
  constructor(
    public readonly code: NeodbErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'NeodbExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof NeodbExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

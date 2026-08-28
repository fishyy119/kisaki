export type VndbErrorCode =
  | 'token_invalid'
  | 'token_required'
  | 'vndb_not_found'
  | 'vndb_rate_limited'
  | 'vndb_rejected'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'list_permission_missing'
  | 'operation_running'

export class VndbExtensionError extends Error {
  constructor(
    public readonly code: VndbErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'VndbExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof VndbExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

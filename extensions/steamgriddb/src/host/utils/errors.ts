export type SgdbErrorCode =
  | 'key_required'
  | 'key_rejected'
  | 'sgdb_not_found'
  | 'sgdb_rate_limited'
  | 'sgdb_rejected'
  | 'network_failed'
  | 'entry_id_invalid'

export class SgdbExtensionError extends Error {
  constructor(
    public readonly code: SgdbErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'SgdbExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof SgdbExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

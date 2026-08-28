export type MangadexErrorCode =
  | 'auth_required'
  | 'auth_failed'
  | 'mangadex_not_found'
  | 'mangadex_rate_limited'
  | 'mangadex_rejected'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'credentials_incomplete'
  | 'operation_running'

export class MangadexExtensionError extends Error {
  constructor(
    public readonly code: MangadexErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'MangadexExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof MangadexExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

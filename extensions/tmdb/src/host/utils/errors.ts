export type TmdbErrorCode =
  | 'api_key_missing'
  | 'api_key_invalid'
  | 'tmdb_not_found'
  | 'tmdb_rate_limited'
  | 'tmdb_rejected'
  | 'network_failed'
  | 'subject_id_invalid'

export class TmdbExtensionError extends Error {
  constructor(
    public readonly code: TmdbErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'TmdbExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof TmdbExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

export type SteamErrorCode =
  | 'key_required'
  | 'key_rejected'
  | 'steam_id_invalid'
  | 'profile_required'
  | 'profile_not_visible'
  | 'steam_not_found'
  | 'steam_rate_limited'
  | 'steam_rejected'
  | 'network_failed'
  | 'entry_id_invalid'
  | 'operation_running'

export class SteamExtensionError extends Error {
  constructor(
    public readonly code: SteamErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'SteamExtensionError'
  }
}

export function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof SteamExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

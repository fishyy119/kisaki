export const GBOOKS_STORAGE_KEYS = {
  settings: 'settings.v1'
} as const

export const GBOOKS_SECRET_KEYS = {
  token: 'auth.token',
  pendingSession: 'auth.pending-session',
  apiKey: 'auth.api-key'
} as const

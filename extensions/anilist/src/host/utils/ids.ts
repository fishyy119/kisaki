export const ANILIST_STORAGE_KEYS = {
  settings: 'settings.v1',
  syncState: 'sync-state.v1'
} as const

export const ANILIST_SECRET_KEYS = {
  token: 'auth.token',
  pendingSession: 'auth.pending-session'
} as const

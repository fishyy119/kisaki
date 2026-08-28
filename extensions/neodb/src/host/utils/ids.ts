export const NEODB_STORAGE_KEYS = {
  settings: 'settings.v1',
  syncState: 'sync-state.v1'
} as const

export const NEODB_SECRET_KEYS = {
  session: 'auth.session',
  pendingLogin: 'auth.pending-login'
} as const

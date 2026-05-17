export const BANGUMI_STORAGE_KEYS = {
  settings: 'settings.v1',
  account: 'auth.account',
  syncState: 'sync.state',
  syncQueue: 'sync.queue',
  lastRelayHealth: 'diagnostics.lastRelayHealth'
} as const

export const BANGUMI_SECRET_KEYS = {
  token: 'auth.token',
  pendingSession: 'auth.pendingSession'
} as const


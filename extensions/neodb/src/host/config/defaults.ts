import { NEODB_DEFAULT_INSTANCE_URL } from '../../shared/settings'
import type { NeodbSettingsV1 } from './schema'

export const DEFAULT_NEODB_SETTINGS: NeodbSettingsV1 = {
  version: 1,
  endpoints: {
    instanceUrl: NEODB_DEFAULT_INSTANCE_URL
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  },
  sync: {
    enabled: false,
    pushScore: true,
    visibility: 'self'
  }
}

export function createDefaultNeodbSettings(): NeodbSettingsV1 {
  return structuredClone(DEFAULT_NEODB_SETTINGS)
}

import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { createDefaultVndbSettings } from './defaults'
import { isVndbSettingsV1, normalizeVndbSettings, type VndbSettingsV1 } from './schema'
import { VNDB_STORAGE_KEYS } from '../utils/ids'

export class SettingsStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<VndbSettingsV1> {
    const raw = await this.storage.get(VNDB_STORAGE_KEYS.settings)
    const settings = normalizeVndbSettings(raw)

    if (!isVndbSettingsV1(raw)) {
      await this.storage.set(VNDB_STORAGE_KEYS.settings, settings)
    }

    return settings
  }

  async set(settings: VndbSettingsV1): Promise<VndbSettingsV1> {
    const normalized = normalizeVndbSettings(settings)
    await this.storage.set(VNDB_STORAGE_KEYS.settings, normalized)
    return normalized
  }

  async reset(): Promise<VndbSettingsV1> {
    const settings = createDefaultVndbSettings()
    await this.storage.set(VNDB_STORAGE_KEYS.settings, settings)
    return settings
  }
}

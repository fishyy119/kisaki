import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { createDefaultYmgalSettings } from './defaults'
import { isYmgalSettingsV1, normalizeYmgalSettings, type YmgalSettingsV1 } from './schema'
import { YMGAL_STORAGE_KEYS } from '../utils/ids'

export class SettingsStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<YmgalSettingsV1> {
    const raw = await this.storage.get(YMGAL_STORAGE_KEYS.settings)
    const settings = normalizeYmgalSettings(raw)

    if (!isYmgalSettingsV1(raw)) {
      await this.storage.set(YMGAL_STORAGE_KEYS.settings, settings)
    }

    return settings
  }

  async set(settings: YmgalSettingsV1): Promise<YmgalSettingsV1> {
    const normalized = normalizeYmgalSettings(settings)
    await this.storage.set(YMGAL_STORAGE_KEYS.settings, normalized)
    return normalized
  }

  async reset(): Promise<YmgalSettingsV1> {
    const settings = createDefaultYmgalSettings()
    await this.storage.set(YMGAL_STORAGE_KEYS.settings, settings)
    return settings
  }
}

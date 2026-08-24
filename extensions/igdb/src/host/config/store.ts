import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { createDefaultIgdbSettings } from './defaults'
import { isIgdbSettingsV1, normalizeIgdbSettings, type IgdbSettingsV1 } from './schema'
import { IGDB_STORAGE_KEYS } from '../utils/ids'

export class SettingsStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<IgdbSettingsV1> {
    const raw = await this.storage.get(IGDB_STORAGE_KEYS.settings)
    const settings = normalizeIgdbSettings(raw)

    if (!isIgdbSettingsV1(raw)) {
      await this.storage.set(IGDB_STORAGE_KEYS.settings, settings)
    }

    return settings
  }

  async set(settings: IgdbSettingsV1): Promise<IgdbSettingsV1> {
    const normalized = normalizeIgdbSettings(settings)
    await this.storage.set(IGDB_STORAGE_KEYS.settings, normalized)
    return normalized
  }

  async reset(): Promise<IgdbSettingsV1> {
    const settings = createDefaultIgdbSettings()
    await this.storage.set(IGDB_STORAGE_KEYS.settings, settings)
    return settings
  }
}

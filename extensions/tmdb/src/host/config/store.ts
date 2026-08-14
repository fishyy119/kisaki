import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { createDefaultTmdbSettings } from './defaults'
import { isTmdbSettingsV1, normalizeTmdbSettings, type TmdbSettingsV1 } from './schema'
import { TMDB_STORAGE_KEYS } from '../utils/ids'

export class SettingsStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<TmdbSettingsV1> {
    const raw = await this.storage.get(TMDB_STORAGE_KEYS.settings)
    const settings = normalizeTmdbSettings(raw)

    if (!isTmdbSettingsV1(raw)) {
      await this.storage.set(TMDB_STORAGE_KEYS.settings, settings)
    }

    return settings
  }

  async set(settings: TmdbSettingsV1): Promise<TmdbSettingsV1> {
    const normalized = normalizeTmdbSettings(settings)
    await this.storage.set(TMDB_STORAGE_KEYS.settings, normalized)
    return normalized
  }

  async reset(): Promise<TmdbSettingsV1> {
    const settings = createDefaultTmdbSettings()
    await this.storage.set(TMDB_STORAGE_KEYS.settings, settings)
    return settings
  }
}

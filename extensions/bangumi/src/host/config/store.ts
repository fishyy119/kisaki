import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { createDefaultBangumiSettings } from './defaults'
import { isBangumiSettingsV1, normalizeBangumiSettings, type BangumiSettingsV1 } from './schema'
import { BANGUMI_STORAGE_KEYS } from '../utils/ids'

export class SettingsStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<BangumiSettingsV1> {
    const raw = await this.storage.get(BANGUMI_STORAGE_KEYS.settings)
    const settings = normalizeBangumiSettings(raw)

    if (!isBangumiSettingsV1(raw)) {
      await this.storage.set(BANGUMI_STORAGE_KEYS.settings, settings)
    }

    return settings
  }

  async set(settings: BangumiSettingsV1): Promise<BangumiSettingsV1> {
    const normalized = normalizeBangumiSettings(settings)
    await this.storage.set(BANGUMI_STORAGE_KEYS.settings, normalized)
    return normalized
  }

  async reset(): Promise<BangumiSettingsV1> {
    const settings = createDefaultBangumiSettings()
    await this.storage.set(BANGUMI_STORAGE_KEYS.settings, settings)
    return settings
  }
}

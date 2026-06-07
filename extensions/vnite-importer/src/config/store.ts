import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import { VNITE_IMPORTER_STORAGE_KEYS } from '../shared/constants'
import { createDefaultVniteImporterSettings } from './defaults'
import {
  isVniteImporterSettingsV1,
  normalizeVniteImporterSettings,
  type VniteImporterSettingsV1
} from './schema'

export class VniteImporterSettingsStore {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(): Promise<VniteImporterSettingsV1> {
    const raw = await this.storage.get<unknown>(VNITE_IMPORTER_STORAGE_KEYS.settings, null)
    const settings = normalizeVniteImporterSettings(raw)

    if (!isVniteImporterSettingsV1(raw)) {
      await this.storage.set(VNITE_IMPORTER_STORAGE_KEYS.settings, settings)
    }

    return settings
  }

  async set(settings: VniteImporterSettingsV1): Promise<VniteImporterSettingsV1> {
    const normalized = normalizeVniteImporterSettings(settings)
    await this.storage.set(VNITE_IMPORTER_STORAGE_KEYS.settings, normalized)
    return normalized
  }

  async update(
    update: (settings: VniteImporterSettingsV1) => VniteImporterSettingsV1
  ): Promise<VniteImporterSettingsV1> {
    return await this.set(update(await this.get()))
  }

  async reset(): Promise<VniteImporterSettingsV1> {
    const settings = createDefaultVniteImporterSettings()
    await this.storage.set(VNITE_IMPORTER_STORAGE_KEYS.settings, settings)
    return settings
  }
}

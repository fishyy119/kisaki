import type { ExtensionStorage } from '@kisaki3/extension-sdk'

/**
 * Per-extension knowledge a settings store is parameterized with.
 *
 * `normalize` must be a total parse: any stored value maps to valid settings
 * (lenient read), and its output must be a fixed point — normalizing a
 * normalized value yields an equal value — because canonical-form detection
 * relies on it.
 */
export interface SettingsCodec<TSettings> {
  normalize(value: unknown): TSettings
  createDefault(): TSettings
}

/**
 * Settings store on extension storage: lenient read, strict write.
 *
 * Reads degrade malformed content to the codec's canonical form and heal the
 * stored value in place; writes persist only the canonical form, so a value
 * round-trips to itself by construction. Version evolution lives in the
 * codec: stored shapes carry their version and `normalize` migrates them.
 */
export class SettingsStore<TSettings> {
  constructor(
    private readonly storage: ExtensionStorage,
    private readonly key: string,
    private readonly codec: SettingsCodec<TSettings>
  ) {}

  async get(): Promise<TSettings> {
    const raw = await this.storage.get(this.key)
    const settings = this.codec.normalize(raw)

    if (!isCanonical(raw, settings)) {
      await this.storage.set(this.key, settings)
    }

    return settings
  }

  async set(settings: TSettings): Promise<TSettings> {
    const normalized = this.codec.normalize(settings)
    await this.storage.set(this.key, normalized)
    return normalized
  }

  async reset(): Promise<TSettings> {
    const settings = this.codec.createDefault()
    await this.storage.set(this.key, settings)
    return settings
  }
}

function isCanonical(raw: unknown, normalized: unknown): boolean {
  return JSON.stringify(raw) === JSON.stringify(normalized)
}

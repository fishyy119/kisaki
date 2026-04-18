import type {
  ExtensionSearchOptions,
  ExtensionSearchResult,
  ExtensionSourceLocator,
  ExtensionSourceEntry,
  ExtensionSourceProvider,
  ExtensionSourceProviderInfo
} from '../types'

/**
 * Coordinates extension package sources without owning install workflows.
 */
export class ExtensionSourceManager {
  private readonly providers = new Map<string, ExtensionSourceProvider>()

  register(provider: ExtensionSourceProvider): void {
    this.providers.set(provider.name, provider)
  }

  getProvider(name: string): ExtensionSourceProvider | undefined {
    return this.providers.get(name)
  }

  getSearchableProviders(): readonly ExtensionSourceProviderInfo[] {
    return [...this.providers.values()]
      .filter((provider) => provider.searchable)
      .map((provider) => ({
        name: provider.name,
        displayName: provider.displayName,
        searchable: provider.searchable
      }))
  }

  async search(
    providerName: string,
    query: string,
    options?: ExtensionSearchOptions
  ): Promise<ExtensionSearchResult> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Extension source provider not found: ${providerName}`)
    }

    if (!provider.searchable) {
      throw new Error(`Extension source provider "${providerName}" does not support search`)
    }

    return provider.search(query, options)
  }

  async resolve(source: string, providerName?: string): Promise<ExtensionSourceEntry | null> {
    if (providerName) {
      const provider = this.providers.get(providerName)
      if (!provider) {
        throw new Error(`Extension source provider not found: ${providerName}`)
      }

      return provider.resolve(source)
    }

    for (const provider of this.providers.values()) {
      const resolved = await provider.resolve(source)
      if (resolved) {
        return resolved
      }
    }

    return null
  }

  async download(entry: ExtensionSourceEntry): Promise<string> {
    const provider = this.providers.get(entry.provider)
    if (!provider) {
      throw new Error(`Extension source provider not found: ${entry.provider}`)
    }

    return provider.download(entry)
  }

  async getLatestVersion(
    extensionId: string,
    source: ExtensionSourceLocator
  ): Promise<string | null> {
    const provider = this.providers.get(source.provider)
    if (!provider) {
      throw new Error(`Extension source provider not found: ${source.provider}`)
    }

    return provider.getLatestVersion(extensionId, source.locator)
  }
}

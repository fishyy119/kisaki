import type {
  CharacterScraperProvider,
  DeeplinkContribution,
  EntityMenuContribution,
  ExtensionContext,
  ExtensionDefinition,
  ExtensionRuntimeMetadata,
  GameScraperProvider,
  PersonScraperProvider,
  CompanyScraperProvider,
  SettingsPanelContribution,
  ThemeContribution,
  DisposableStore
} from '@kisaki/extension-api'

export interface LoadedExtensionRuntime {
  metadata: ExtensionRuntimeMetadata
  generation: number
  definition: ExtensionDefinition
  context: ExtensionContext
  subscriptions: DisposableStore
  abortController: AbortController
  entityMenus: Map<string, EntityMenuContribution>
  settingsPanels: Map<string, SettingsPanelContribution>
  gameScrapers: Map<string, GameScraperProvider>
  personScrapers: Map<string, PersonScraperProvider>
  companyScrapers: Map<string, CompanyScraperProvider>
  characterScrapers: Map<string, CharacterScraperProvider>
  deeplinks: Map<string, DeeplinkContribution>
  themes: Map<string, ThemeContribution>
}

/**
 * Tracks all extension runtime state inside the shared extension host process.
 */
export class ExtensionRegistry {
  private readonly loaded = new Map<string, LoadedExtensionRuntime>()

  add(runtime: LoadedExtensionRuntime): void {
    this.loaded.set(runtime.metadata.id, runtime)
  }

  get(extensionId: string): LoadedExtensionRuntime | undefined {
    return this.loaded.get(extensionId)
  }

  remove(extensionId: string): LoadedExtensionRuntime | undefined {
    const runtime = this.loaded.get(extensionId)
    if (!runtime) {
      return undefined
    }

    this.loaded.delete(extensionId)
    return runtime
  }

  delete(extensionId: string): boolean {
    return this.loaded.delete(extensionId)
  }

  has(extensionId: string): boolean {
    return this.loaded.has(extensionId)
  }

  list(): readonly LoadedExtensionRuntime[] {
    return [...this.loaded.values()]
  }

  registerEntityMenu(extensionId: string, contribution: EntityMenuContribution): void {
    this.require(extensionId).entityMenus.set(contribution.id, contribution)
  }

  unregisterEntityMenu(extensionId: string, contributionId: string): void {
    this.require(extensionId).entityMenus.delete(contributionId)
  }

  registerSettingsPanel(extensionId: string, contribution: SettingsPanelContribution): void {
    this.require(extensionId).settingsPanels.set(contribution.id, contribution)
  }

  unregisterSettingsPanel(extensionId: string, panelId: string): void {
    this.require(extensionId).settingsPanels.delete(panelId)
  }

  registerGameScraper(extensionId: string, provider: GameScraperProvider): void {
    this.require(extensionId).gameScrapers.set(provider.id, provider)
  }

  unregisterGameScraper(extensionId: string, providerId: string): void {
    this.require(extensionId).gameScrapers.delete(providerId)
  }

  registerPersonScraper(extensionId: string, provider: PersonScraperProvider): void {
    this.require(extensionId).personScrapers.set(provider.id, provider)
  }

  unregisterPersonScraper(extensionId: string, providerId: string): void {
    this.require(extensionId).personScrapers.delete(providerId)
  }

  registerCompanyScraper(extensionId: string, provider: CompanyScraperProvider): void {
    this.require(extensionId).companyScrapers.set(provider.id, provider)
  }

  unregisterCompanyScraper(extensionId: string, providerId: string): void {
    this.require(extensionId).companyScrapers.delete(providerId)
  }

  registerCharacterScraper(extensionId: string, provider: CharacterScraperProvider): void {
    this.require(extensionId).characterScrapers.set(provider.id, provider)
  }

  unregisterCharacterScraper(extensionId: string, providerId: string): void {
    this.require(extensionId).characterScrapers.delete(providerId)
  }

  registerDeeplink(extensionId: string, contribution: DeeplinkContribution): void {
    this.require(extensionId).deeplinks.set(contribution.id, contribution)
  }

  unregisterDeeplink(extensionId: string, contributionId: string): void {
    this.require(extensionId).deeplinks.delete(contributionId)
  }

  registerTheme(extensionId: string, theme: ThemeContribution): void {
    this.require(extensionId).themes.set(theme.id, theme)
  }

  unregisterTheme(extensionId: string, themeId: string): void {
    this.require(extensionId).themes.delete(themeId)
  }

  private require(extensionId: string): LoadedExtensionRuntime {
    const runtime = this.loaded.get(extensionId)
    if (!runtime) {
      throw new Error(`Extension "${extensionId}" is not loaded in the host registry`)
    }

    return runtime
  }
}

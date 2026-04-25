import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  DeeplinkContribution,
  DisposableStore,
  EntityMenuContribution,
  GameScraperProvider,
  PersonScraperProvider,
  SettingsPanelContribution,
  ThemeContribution
} from '@kisaki/extension-api'
import type { ExtensionSdkBridge } from './types'

/**
 * Creates the entity menu contribution registrar bound to runtime subscriptions.
 */
export function createEntityMenuRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
) {
  return {
    register(contribution: EntityMenuContribution) {
      const disposable = bridge.registerEntityMenu(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the settings panel contribution registrar bound to runtime subscriptions.
 */
export function createSettingsPanelRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
) {
  return {
    register(contribution: SettingsPanelContribution) {
      const disposable = bridge.registerSettingsPanel(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the scraper contribution registrar bound to runtime subscriptions.
 */
export function createScraperRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    registerGameProvider(provider: GameScraperProvider) {
      const disposable = bridge.registerGameScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerPersonProvider(provider: PersonScraperProvider) {
      const disposable = bridge.registerPersonScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCompanyProvider(provider: CompanyScraperProvider) {
      const disposable = bridge.registerCompanyScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCharacterProvider(provider: CharacterScraperProvider) {
      const disposable = bridge.registerCharacterScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the deeplink contribution registrar bound to runtime subscriptions.
 */
export function createDeeplinkRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
) {
  return {
    register(contribution: DeeplinkContribution) {
      const disposable = bridge.registerDeeplink(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the theme contribution registrar bound to runtime subscriptions.
 */
export function createThemeRegistrar(bridge: ExtensionSdkBridge, subscriptions: DisposableStore) {
  return {
    register(theme: ThemeContribution) {
      const disposable = bridge.registerTheme(theme)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

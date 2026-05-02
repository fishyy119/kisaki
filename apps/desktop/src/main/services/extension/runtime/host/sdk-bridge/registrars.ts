import type {
  CharacterScraperProvider,
  CommandContribution,
  CompanyScraperProvider,
  DeeplinkContribution,
  DisposableStore,
  EntityMenuContribution,
  GameScraperProvider,
  PersonScraperProvider,
  SettingsContribution,
  ThemeContribution
} from '@kisaki/extension-api'
import type { ActiveExtensionScope, ExtensionSdkBridge } from './types'

/**
 * Creates the command contribution registrar bound to runtime subscriptions.
 */
export function createCommandRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
) {
  return {
    async register(command: CommandContribution) {
      const disposable = await bridge.registerCommand(scope, command)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the entity menu contribution registrar bound to runtime subscriptions.
 */
export function createEntityMenuRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
) {
  return {
    register(contribution: EntityMenuContribution) {
      const disposable = bridge.registerEntityMenu(scope, contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the settings contribution registrar bound to runtime subscriptions.
 */
export function createSettingsRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
) {
  return {
    register(contribution: SettingsContribution) {
      const disposable = bridge.registerSettings(scope, contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the scraper contribution registrar bound to runtime subscriptions.
 */
export function createScraperRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
) {
  return {
    registerGameProvider(provider: GameScraperProvider) {
      const disposable = bridge.registerGameScraperProvider(scope, provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerPersonProvider(provider: PersonScraperProvider) {
      const disposable = bridge.registerPersonScraperProvider(scope, provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCompanyProvider(provider: CompanyScraperProvider) {
      const disposable = bridge.registerCompanyScraperProvider(scope, provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCharacterProvider(provider: CharacterScraperProvider) {
      const disposable = bridge.registerCharacterScraperProvider(scope, provider)
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
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
) {
  return {
    register(contribution: DeeplinkContribution) {
      const disposable = bridge.registerDeeplink(scope, contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the theme contribution registrar bound to runtime subscriptions.
 */
export function createThemeRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
) {
  return {
    register(theme: ThemeContribution) {
      const disposable = bridge.registerTheme(scope, theme)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

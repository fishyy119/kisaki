import type {
  CharacterScraperProvider,
  CommandContribution,
  CompanyScraperProvider,
  DeeplinkContribution,
  DisposableStore,
  GameScraperProvider,
  MenuContribution,
  MenuInputFor,
  MenuInputMap,
  MenuRegistrar,
  MenuScope,
  PersonScraperProvider,
  SettingsContribution,
  SettingsDialogMap,
  SettingsPopoverMap,
  SettingsRegistrar,
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
 * Creates the menu contribution registrar bound to runtime subscriptions.
 */
export function createMenuRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): MenuRegistrar {
  const point = <const TDomain extends keyof MenuInputMap, const TScope extends MenuScope<TDomain>>(
    domain: TDomain,
    menuScope: TScope
  ) => ({
    register(contribution: MenuContribution<MenuInputFor<TDomain, TScope>>) {
      const disposable = bridge.registerMenu(scope, domain, menuScope, contribution)
      subscriptions.add(disposable)
      return disposable
    }
  })

  return {
    game: {
      single: point('game', 'single'),
      batch: point('game', 'batch')
    },
    character: {
      single: point('character', 'single')
    },
    person: {
      single: point('person', 'single')
    },
    company: {
      single: point('company', 'single')
    },
    collection: {
      single: point('collection', 'single')
    },
    tag: {
      single: point('tag', 'single')
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
): SettingsRegistrar {
  return {
    register<
      const TPopovers extends SettingsPopoverMap,
      const TDialogs extends SettingsDialogMap<TPopovers>
    >(contribution: SettingsContribution<TPopovers, TDialogs>) {
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

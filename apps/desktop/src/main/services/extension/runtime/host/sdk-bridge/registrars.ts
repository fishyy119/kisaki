import type {
  AnimeScraperProvider,
  CardActionContribution,
  CardActionRegistrar,
  CharacterScraperProvider,
  ComicScraperProvider,
  CommandContribution,
  CommandRegistrar,
  CompanyScraperProvider,
  DeeplinkRouteContribution,
  DeeplinkRouteRegistrar,
  DisposableStore,
  EntityMenuContribution,
  EntityMenuInputFor,
  EntityMenuInputMap,
  EntityMenuRegistrar,
  EntityMenuScope,
  ExtensionHookHandler,
  ExtensionHookPointId,
  GameScraperProvider,
  HooksRegistrar,
  HookTapOptions,
  NovelScraperProvider,
  PersonScraperProvider,
  ScraperProviderRegistrar,
  ThemeRegistrar,
  ThemeContribution,
  WebviewDialogContribution,
  WebviewPageContribution,
  WebviewRegistrar
} from '@kisaki3/extension-api'
import type { ActiveExtensionScope, ExtensionSdkBridge } from './types'

/**
 * Creates the command contribution registrar bound to runtime subscriptions.
 */
export function createCommandRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): CommandRegistrar {
  return {
    register(command: CommandContribution) {
      const disposable = bridge.registerCommand(scope, command)
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
): EntityMenuRegistrar {
  const point = <
    const TDomain extends keyof EntityMenuInputMap,
    const TScope extends EntityMenuScope<TDomain>
  >(
    domain: TDomain,
    menuScope: TScope
  ) => ({
    register(contribution: EntityMenuContribution<EntityMenuInputFor<TDomain, TScope>>) {
      const disposable = bridge.registerEntityMenu(scope, domain, menuScope, contribution)
      subscriptions.add(disposable)
      return disposable
    }
  })

  return {
    game: {
      single: point('game', 'single'),
      batch: point('game', 'batch')
    },
    anime: {
      single: point('anime', 'single'),
      batch: point('anime', 'batch')
    },
    comic: {
      single: point('comic', 'single'),
      batch: point('comic', 'batch')
    },
    novel: {
      single: point('novel', 'single'),
      batch: point('novel', 'batch')
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
 * Creates the card action contribution registrar bound to runtime subscriptions.
 */
export function createCardActionRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): CardActionRegistrar {
  return {
    register(action: CardActionContribution) {
      const disposable = bridge.registerCardAction(scope, action)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the scraper provider contribution registrar bound to runtime subscriptions.
 */
export function createScraperProviderRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): ScraperProviderRegistrar {
  return {
    game: {
      register(provider: GameScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'game', provider)
        subscriptions.add(disposable)
        return disposable
      }
    },
    anime: {
      register(provider: AnimeScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'anime', provider)
        subscriptions.add(disposable)
        return disposable
      }
    },
    comic: {
      register(provider: ComicScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'comic', provider)
        subscriptions.add(disposable)
        return disposable
      }
    },
    novel: {
      register(provider: NovelScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'novel', provider)
        subscriptions.add(disposable)
        return disposable
      }
    },
    person: {
      register(provider: PersonScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'person', provider)
        subscriptions.add(disposable)
        return disposable
      }
    },
    company: {
      register(provider: CompanyScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'company', provider)
        subscriptions.add(disposable)
        return disposable
      }
    },
    character: {
      register(provider: CharacterScraperProvider) {
        const disposable = bridge.registerScraperProvider(scope, 'character', provider)
        subscriptions.add(disposable)
        return disposable
      }
    }
  }
}

/**
 * Creates the deeplink route contribution registrar bound to runtime subscriptions.
 */
export function createDeeplinkRouteRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): DeeplinkRouteRegistrar {
  return {
    register<const TPattern extends string>(contribution: DeeplinkRouteContribution<TPattern>) {
      const disposable = bridge.registerDeeplinkRoute(scope, contribution)
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
): ThemeRegistrar {
  return {
    register(theme: ThemeContribution) {
      const disposable = bridge.registerTheme(scope, theme)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the hooks registration surface bound to runtime subscriptions.
 */
export function createHooksRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): HooksRegistrar {
  return {
    on<TPoint extends ExtensionHookPointId>(
      pointId: TPoint,
      handler: ExtensionHookHandler<TPoint>,
      options?: HookTapOptions
    ) {
      const disposable = bridge.registerHook(scope, pointId, handler, options)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

/**
 * Creates the webview contribution registrar bound to runtime subscriptions.
 */
export function createWebviewRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore,
  scope: ActiveExtensionScope
): WebviewRegistrar {
  return {
    pages: {
      register(page: WebviewPageContribution) {
        const registration = bridge.registerWebviewPage(scope, page)
        subscriptions.add(registration)
        return registration
      }
    },
    dialogs: {
      register(dialog: WebviewDialogContribution) {
        const registration = bridge.registerWebviewDialog(scope, dialog)
        subscriptions.add(registration)
        return registration
      }
    }
  }
}

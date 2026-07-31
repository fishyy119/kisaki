import type {
  CardActionContribution,
  CharacterScraperProvider,
  CommandContribution,
  DeeplinkRouteContribution,
  EntityMenuContribution,
  EntityMenuDomain,
  EntityMenuInput,
  EntityMenuInputFor,
  EntityMenuScope,
  ExtensionContext,
  ExtensionDefinition,
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  GameScraperProvider,
  PersonScraperProvider,
  CompanyScraperProvider,
  ScraperMediaType,
  ThemeContribution,
  DisposableStore,
  WebviewDialogContribution,
  WebviewHandle,
  WebviewPageContribution
} from '@kisaki3/extension-api'

export interface RegisteredEntityMenuContributionFor<
  TDomain extends EntityMenuDomain,
  TScope extends EntityMenuScope<TDomain>
> {
  id: string
  domain: TDomain
  scope: TScope
  order?: number
  contribution: EntityMenuContribution<EntityMenuInputFor<TDomain, TScope>>
}

export type RegisteredEntityMenuContribution = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: RegisteredEntityMenuContributionFor<TDomain, TScope>
  }[EntityMenuScope<TDomain>]
}[EntityMenuDomain]

export type EntityMenuRegistrationMaps = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: Map<
      string,
      RegisteredEntityMenuContributionFor<TDomain, TScope>
    >
  }
}

export interface ScraperProviderMaps {
  game: Map<string, GameScraperProvider>
  person: Map<string, PersonScraperProvider>
  company: Map<string, CompanyScraperProvider>
  character: Map<string, CharacterScraperProvider>
}

export type ScraperProviderFor<TMediaType extends ScraperMediaType> =
  ScraperProviderMaps[TMediaType] extends Map<string, infer TProvider> ? TProvider : never

/**
 * Declared webview surface plus the host-side `onOpen` listeners that receive
 * every session opened for it.
 */
export interface RegisteredWebviewSurface<TContribution> {
  contribution: TContribution
  openListeners: Set<(webview: WebviewHandle) => void>
}

export type RegisteredWebviewPage = RegisteredWebviewSurface<WebviewPageContribution>

export type RegisteredWebviewDialog = RegisteredWebviewSurface<WebviewDialogContribution>

export interface LoadedExtensionRuntime {
  metadata: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  generation: number
  definition: ExtensionDefinition
  context: ExtensionContext
  subscriptions: DisposableStore
  abortController: AbortController
  entityMenus: EntityMenuRegistrationMaps
  cardActions: Map<string, CardActionContribution>
  scraperProviders: ScraperProviderMaps
  deeplinkRoutes: Map<string, DeeplinkRouteContribution>
  themes: Map<string, ThemeContribution>
  commands: Map<string, CommandContribution>
  webviewPages: Map<string, RegisteredWebviewPage>
  webviewDialogs: Map<string, RegisteredWebviewDialog>
}

/**
 * Tracks all extension runtime state inside the shared extension host process.
 */
export class ExtensionRegistry {
  private readonly loaded = new Map<string, LoadedExtensionRuntime>()
  private readonly byRuntimeHandle = new Map<ExtensionRuntimeHandle, LoadedExtensionRuntime>()

  add(runtime: LoadedExtensionRuntime): void {
    this.loaded.set(runtime.metadata.id, runtime)
    this.byRuntimeHandle.set(runtime.runtimeHandle, runtime)
  }

  get(extensionId: string): LoadedExtensionRuntime | undefined {
    return this.loaded.get(extensionId)
  }

  getByRuntimeHandle(runtimeHandle: ExtensionRuntimeHandle): LoadedExtensionRuntime | undefined {
    return this.byRuntimeHandle.get(runtimeHandle)
  }

  remove(extensionId: string): LoadedExtensionRuntime | undefined {
    const runtime = this.loaded.get(extensionId)
    if (!runtime) {
      return undefined
    }

    this.loaded.delete(extensionId)
    this.byRuntimeHandle.delete(runtime.runtimeHandle)
    return runtime
  }

  delete(extensionId: string): boolean {
    const runtime = this.loaded.get(extensionId)
    if (!runtime) {
      return false
    }

    this.loaded.delete(extensionId)
    this.byRuntimeHandle.delete(runtime.runtimeHandle)
    return true
  }

  has(extensionId: string): boolean {
    return this.loaded.has(extensionId)
  }

  list(): readonly LoadedExtensionRuntime[] {
    return [...this.loaded.values()]
  }

  registerEntityMenu<TDomain extends EntityMenuDomain, TScope extends EntityMenuScope<TDomain>>(
    extensionId: string,
    registration: RegisteredEntityMenuContributionFor<TDomain, TScope>
  ): void {
    getEntityMenuRegistrationMap(
      this.require(extensionId),
      registration.domain,
      registration.scope
    ).set(registration.id, registration)
  }

  unregisterEntityMenu<TDomain extends EntityMenuDomain, TScope extends EntityMenuScope<TDomain>>(
    extensionId: string,
    domain: TDomain,
    scope: TScope,
    contributionId: string
  ): void {
    getEntityMenuRegistrationMap(this.require(extensionId), domain, scope).delete(contributionId)
  }

  registerCardAction(extensionId: string, action: CardActionContribution): void {
    this.require(extensionId).cardActions.set(action.id, action)
  }

  unregisterCardAction(extensionId: string, contributionId: string): void {
    this.require(extensionId).cardActions.delete(contributionId)
  }

  getScraperProviders<TMediaType extends ScraperMediaType>(
    extensionId: string,
    mediaType: TMediaType
  ): LoadedExtensionRuntime['scraperProviders'][TMediaType] {
    return this.require(extensionId).scraperProviders[mediaType]
  }

  registerScraperProvider<TMediaType extends ScraperMediaType>(
    extensionId: string,
    mediaType: TMediaType,
    provider: ScraperProviderFor<TMediaType> & { id: string }
  ): void {
    getScraperProviderMap(this.require(extensionId), mediaType).set(provider.id, provider)
  }

  unregisterScraperProvider<TMediaType extends ScraperMediaType>(
    extensionId: string,
    mediaType: TMediaType,
    providerId: string
  ): void {
    getScraperProviderMap(this.require(extensionId), mediaType).delete(providerId)
  }

  registerDeeplinkRoute(extensionId: string, contribution: DeeplinkRouteContribution): void {
    this.require(extensionId).deeplinkRoutes.set(contribution.id, contribution)
  }

  unregisterDeeplinkRoute(extensionId: string, contributionId: string): void {
    this.require(extensionId).deeplinkRoutes.delete(contributionId)
  }

  registerTheme(extensionId: string, theme: ThemeContribution): void {
    this.require(extensionId).themes.set(theme.id, theme)
  }

  unregisterTheme(extensionId: string, themeId: string): void {
    this.require(extensionId).themes.delete(themeId)
  }

  registerCommand(extensionId: string, command: CommandContribution): void {
    this.require(extensionId).commands.set(command.id, command)
  }

  unregisterCommand(extensionId: string, commandId: string): void {
    this.require(extensionId).commands.delete(commandId)
  }

  registerWebviewPage(extensionId: string, page: WebviewPageContribution): RegisteredWebviewPage {
    const registered: RegisteredWebviewPage = { contribution: page, openListeners: new Set() }
    this.require(extensionId).webviewPages.set(page.id, registered)
    return registered
  }

  unregisterWebviewPage(extensionId: string, pageId: string): void {
    this.require(extensionId).webviewPages.delete(pageId)
  }

  registerWebviewDialog(
    extensionId: string,
    dialog: WebviewDialogContribution
  ): RegisteredWebviewDialog {
    const registered: RegisteredWebviewDialog = { contribution: dialog, openListeners: new Set() }
    this.require(extensionId).webviewDialogs.set(dialog.id, registered)
    return registered
  }

  unregisterWebviewDialog(extensionId: string, dialogId: string): void {
    this.require(extensionId).webviewDialogs.delete(dialogId)
  }

  private require(extensionId: string): LoadedExtensionRuntime {
    const runtime = this.loaded.get(extensionId)
    if (!runtime) {
      throw new Error(`Extension "${extensionId}" is not loaded in the host registry`)
    }

    return runtime
  }
}

export function createEntityMenuRegistrationMaps(): EntityMenuRegistrationMaps {
  return {
    game: {
      single: new Map(),
      batch: new Map()
    },
    character: {
      single: new Map()
    },
    person: {
      single: new Map()
    },
    company: {
      single: new Map()
    },
    collection: {
      single: new Map()
    },
    tag: {
      single: new Map()
    }
  } as EntityMenuRegistrationMaps
}

export function getEntityMenuRegistrationMap<
  TDomain extends EntityMenuDomain,
  TScope extends EntityMenuScope<TDomain>
>(
  runtime: LoadedExtensionRuntime,
  domain: TDomain,
  scope: TScope
): Map<string, RegisteredEntityMenuContributionFor<TDomain, TScope>> {
  return runtime.entityMenus[domain][scope] as unknown as Map<
    string,
    RegisteredEntityMenuContributionFor<TDomain, TScope>
  >
}

export function getEntityMenuRegistrationForInput(
  runtime: LoadedExtensionRuntime,
  input: EntityMenuInput,
  contributionId: string
): RegisteredEntityMenuContribution | undefined {
  switch (input.domain) {
    case 'game':
      return runtime.entityMenus.game[input.scope].get(contributionId)
    case 'character':
      return runtime.entityMenus.character.single.get(contributionId)
    case 'person':
      return runtime.entityMenus.person.single.get(contributionId)
    case 'company':
      return runtime.entityMenus.company.single.get(contributionId)
    case 'collection':
      return runtime.entityMenus.collection.single.get(contributionId)
    case 'tag':
      return runtime.entityMenus.tag.single.get(contributionId)
  }
}

export function getScraperProviderMap<TMediaType extends ScraperMediaType>(
  runtime: LoadedExtensionRuntime,
  mediaType: TMediaType
): Map<string, ScraperProviderFor<TMediaType>> {
  return runtime.scraperProviders[mediaType] as unknown as Map<
    string,
    ScraperProviderFor<TMediaType>
  >
}

export function createScraperProviderMaps(): ScraperProviderMaps {
  return {
    game: new Map(),
    person: new Map(),
    company: new Map(),
    character: new Map()
  }
}

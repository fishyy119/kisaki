import type {
  AnimeScraperProvider,
  CardActionContribution,
  CardActionRegistration,
  CharacterScraperProvider,
  CompanyScraperProvider,
  CommandContribution,
  CommandRegistration,
  DeeplinkRouteContribution,
  DeeplinkRouteRegistration,
  Disposable,
  EntityMenuContribution,
  EntityMenuDomain,
  EntityMenuInputFor,
  EntityMenuRegistration,
  EntityMenuScope,
  ExtensionHookHandler,
  ExtensionHookPointId,
  ExtensionLogger,
  ExtensionSecrets,
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  ExtensionStorage,
  GameScraperProvider,
  HookTapOptions,
  JsonValue,
  KisakiApi,
  PersonScraperProvider,
  ScraperMediaType,
  ScraperProviderRegistration,
  ThemeRegistration,
  ThemeContribution,
  WebviewDialogContribution,
  WebviewDialogRegistration,
  WebviewPageContribution,
  WebviewPageRegistration
} from '@kisaki3/extension-api'

export type ScraperProviderFor<TMediaType extends ScraperMediaType> = TMediaType extends 'game'
  ? GameScraperProvider
  : TMediaType extends 'anime'
    ? AnimeScraperProvider
    : TMediaType extends 'person'
      ? PersonScraperProvider
      : TMediaType extends 'company'
        ? CompanyScraperProvider
        : CharacterScraperProvider

/**
 * Identifies the extension runtime currently allowed to call SDK APIs.
 */
export interface ActiveExtensionScope {
  extensionId: string
  runtimeHandle: ExtensionRuntimeHandle
  signal?: AbortSignal
}

/**
 * Host-process binding for one open webview session. Routes main-relayed
 * messages and close notifications to author callbacks.
 */
export interface WebviewSessionBinding {
  readonly signal: AbortSignal
  onMessage(listener: (message: JsonValue) => void): Disposable
  onClose(listener: () => void): Disposable
}

/**
 * Private bridge exposed to the public extension SDK package.
 */
export interface ExtensionSdkBridge {
  readonly api: KisakiApi
  createLogger(scope: ActiveExtensionScope, extension: ExtensionRuntimeMetadata): ExtensionLogger
  createStorage(scope: ActiveExtensionScope): ExtensionStorage
  createSecrets(scope: ActiveExtensionScope): ExtensionSecrets
  registerCommand(scope: ActiveExtensionScope, command: CommandContribution): CommandRegistration
  registerEntityMenu<TDomain extends EntityMenuDomain, TScope extends EntityMenuScope<TDomain>>(
    scope: ActiveExtensionScope,
    domain: TDomain,
    menuScope: TScope,
    contribution: EntityMenuContribution<EntityMenuInputFor<TDomain, TScope>>
  ): EntityMenuRegistration
  registerCardAction(
    scope: ActiveExtensionScope,
    action: CardActionContribution
  ): CardActionRegistration
  registerScraperProvider<TMediaType extends ScraperMediaType>(
    scope: ActiveExtensionScope,
    mediaType: TMediaType,
    provider: ScraperProviderFor<TMediaType>
  ): ScraperProviderRegistration
  registerDeeplinkRoute<const TPattern extends string>(
    scope: ActiveExtensionScope,
    contribution: DeeplinkRouteContribution<TPattern>
  ): DeeplinkRouteRegistration
  registerTheme(scope: ActiveExtensionScope, theme: ThemeContribution): ThemeRegistration
  registerWebviewPage(
    scope: ActiveExtensionScope,
    page: WebviewPageContribution
  ): WebviewPageRegistration
  registerWebviewDialog(
    scope: ActiveExtensionScope,
    dialog: WebviewDialogContribution
  ): WebviewDialogRegistration
  registerHook<TPoint extends ExtensionHookPointId>(
    scope: ActiveExtensionScope,
    pointId: TPoint,
    handler: ExtensionHookHandler<TPoint>,
    options?: HookTapOptions
  ): Disposable
  asAbsolutePath(extensionPath: string, relativePath: string): string
}

/**
 * Global SDK bridge slot shared with the extension SDK package in this process.
 */
export interface ExtensionSdkBridgeStore {
  bridge: { readonly api: KisakiApi } | null
}

/**
 * Inputs required to create the public extension activation context.
 */
export interface ExtensionContextOptions {
  extension: ExtensionRuntimeMetadata
  runtimeHandle: ExtensionRuntimeHandle
  abortSignal: AbortSignal
}

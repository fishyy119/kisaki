import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  CommandContribution,
  CommandRegistration,
  DeeplinkRouteContribution,
  DeeplinkRouteRegistration,
  EntityMenuContribution,
  EntityMenuDomain,
  EntityMenuInputFor,
  EntityMenuRegistration,
  EntityMenuScope,
  ExtensionEventListener,
  ExtensionEventPayload,
  ExtensionLogger,
  ExtensionSecrets,
  ExtensionRuntimeHandle,
  ExtensionRuntimeMetadata,
  ExtensionStorage,
  GameScraperProvider,
  HostEventListener,
  HostEventTopic,
  KisakiApi,
  PersonScraperProvider,
  ScraperMediaType,
  ScraperProviderRegistration,
  SettingsPanelContribution,
  SettingsPanelRegistration,
  ThemeRegistration,
  ThemeContribution
} from '@kisaki/extension-api'

export type ScraperProviderFor<TMediaType extends ScraperMediaType> = TMediaType extends 'game'
  ? GameScraperProvider
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
 * Tracks host event callbacks registered through the extension SDK.
 */
export interface HostEventSubscriptionRecord {
  scope: ActiveExtensionScope
  once: boolean
  topic: HostEventTopic
  listener: HostEventListener<HostEventTopic>
}

/**
 * Tracks extension-to-extension event callbacks registered in the host.
 */
export interface ExtensionEventListenerRecord {
  scope: ActiveExtensionScope
  listener: ExtensionEventListener<ExtensionEventPayload>
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
  registerSettingsPanel(
    scope: ActiveExtensionScope,
    contribution: SettingsPanelContribution<any, any>
  ): SettingsPanelRegistration
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

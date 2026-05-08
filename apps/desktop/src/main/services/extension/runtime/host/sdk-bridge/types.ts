import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  CommandContribution,
  DeeplinkContribution,
  DeeplinkRegistrationHandle,
  Disposable,
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
  MenuContribution,
  MenuDomain,
  MenuInputFor,
  MenuRegistration,
  MenuScope,
  PersonScraperProvider,
  SettingsContribution,
  SettingsRegistration,
  ThemeContribution
} from '@kisaki/extension-api'

/**
 * Identifies the extension runtime currently allowed to call SDK APIs.
 */
export interface ActiveExtensionScope {
  extensionId: string
  runtimeHandle: ExtensionRuntimeHandle
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
  registerCommand(scope: ActiveExtensionScope, command: CommandContribution): Promise<Disposable>
  registerMenu<TDomain extends MenuDomain, TScope extends MenuScope<TDomain>>(
    scope: ActiveExtensionScope,
    domain: TDomain,
    menuScope: TScope,
    contribution: MenuContribution<MenuInputFor<TDomain, TScope>>
  ): MenuRegistration
  registerSettings(
    scope: ActiveExtensionScope,
    contribution: SettingsContribution<any, any>
  ): SettingsRegistration
  registerGameScraperProvider(
    scope: ActiveExtensionScope,
    provider: GameScraperProvider
  ): Disposable
  registerPersonScraperProvider(
    scope: ActiveExtensionScope,
    provider: PersonScraperProvider
  ): Disposable
  registerCompanyScraperProvider(
    scope: ActiveExtensionScope,
    provider: CompanyScraperProvider
  ): Disposable
  registerCharacterScraperProvider(
    scope: ActiveExtensionScope,
    provider: CharacterScraperProvider
  ): Disposable
  registerDeeplink(
    scope: ActiveExtensionScope,
    contribution: DeeplinkContribution
  ): DeeplinkRegistrationHandle
  registerTheme(scope: ActiveExtensionScope, theme: ThemeContribution): Disposable
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

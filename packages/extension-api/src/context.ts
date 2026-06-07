import type { DisposableStore, JsonValue } from './shared'
import type {
  CommandRegistrar,
  DeeplinkRouteRegistrar,
  EntityMenuRegistrar,
  ScraperProviderRegistrar,
  SettingsPanelRegistrar,
  ThemeRegistrar
} from './contributions'

export type ExtensionMode = 'development' | 'production'

export interface ExtensionRuntimeMetadata {
  id: string
  name: string
  version: string
  manifestPath: string
  extensionPath: string
  dataPath: string
  tempPath: string
  mode: ExtensionMode
}

export interface ExtensionLogger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface ExtensionStorage {
  get<T extends JsonValue = JsonValue>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  listKeys(prefix?: string): Promise<readonly string[]>
}

export interface ExtensionSecrets {
  get<T extends JsonValue = JsonValue>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  listKeys(prefix?: string): Promise<readonly string[]>
}

export interface ExtensionContext {
  readonly extension: ExtensionRuntimeMetadata
  readonly logger: ExtensionLogger
  readonly storage: ExtensionStorage
  readonly secrets: ExtensionSecrets
  readonly subscriptions: DisposableStore
  readonly abortSignal: AbortSignal
  readonly contributions: ExtensionContributionRegistrars
  asAbsolutePath(relativePath: string): string
}

export interface ExtensionContributionRegistrars {
  readonly entityMenus: EntityMenuRegistrar
  readonly settingsPanels: SettingsPanelRegistrar
  readonly scraperProviders: ScraperProviderRegistrar
  readonly deeplinkRoutes: DeeplinkRouteRegistrar
  readonly themes: ThemeRegistrar
  readonly commands: CommandRegistrar
}

export interface ExtensionDefinition {
  activate(context: ExtensionContext): Promise<void> | void
  deactivate?(context: ExtensionContext): Promise<void> | void
}

import type { DisposableStore, JsonValue } from './shared'
import type {
  CardActionRegistrar,
  CommandRegistrar,
  DeeplinkRouteRegistrar,
  EntityMenuRegistrar,
  ScraperProviderRegistrar,
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

/**
 * Extension-scoped persistent key-value storage.
 * @remarks Values are plain JSON data. `set` normalizes its input before
 * persisting: `undefined` object properties are dropped, and values that are
 * not representable as JSON (Date, Map, Set, class instances, functions,
 * non-finite numbers, circular references) are rejected; `toJSON` is not
 * honored.
 */
export interface ExtensionStorage {
  get<T extends JsonValue = JsonValue>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  listKeys(prefix?: string): Promise<readonly string[]>
}

/**
 * Extension-scoped encrypted key-value storage.
 * @remarks Follows the same strict JSON value contract as {@link ExtensionStorage}.
 */
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
  readonly cardActions: CardActionRegistrar
  readonly scraperProviders: ScraperProviderRegistrar
  readonly deeplinkRoutes: DeeplinkRouteRegistrar
  readonly themes: ThemeRegistrar
  readonly commands: CommandRegistrar
}

export interface ExtensionDefinition {
  activate(context: ExtensionContext): Promise<void> | void
  deactivate?(context: ExtensionContext): Promise<void> | void
}

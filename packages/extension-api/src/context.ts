import type { Disposable, DisposableStore, SerializableValue } from './shared'
import type {
  CommandRegistrar,
  DeeplinkRegistrar,
  EntityMenuRegistrar,
  ScraperRegistrar,
  SettingsRegistrar,
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
  get<T>(key: string, fallback: T): Promise<T>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  listKeys(prefix?: string): Promise<readonly string[]>
}

export interface ExtensionSecrets {
  get<T extends SerializableValue = SerializableValue>(key: string): Promise<T | undefined>
  set<T extends SerializableValue = SerializableValue>(key: string, value: T): Promise<void>
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
  readonly contributions: {
    entityMenus: EntityMenuRegistrar
    settings: SettingsRegistrar
    scrapers: ScraperRegistrar
    deeplinks: DeeplinkRegistrar
    themes: ThemeRegistrar
    commands: CommandRegistrar
  }
  asAbsolutePath(relativePath: string): string
  registerDisposable(disposable: Disposable): void
}

export interface ExtensionDefinition {
  activate(context: ExtensionContext): Promise<void> | void
  deactivate?(context: ExtensionContext): Promise<void> | void
}

import { AsyncLocalStorage } from 'node:async_hooks'
import path from 'node:path'
import type {
  CharacterScraperProvider,
  CompanyScraperProvider,
  DeeplinkContribution,
  Disposable,
  EntityMenuContribution,
  ExtensionLogger,
  ExtensionRuntimeMetadata,
  ExtensionStorage,
  GameScraperProvider,
  KisakiApi,
  PersonScraperProvider,
  RpcValue,
  RuntimeInfo,
  SerializableValue,
  SettingsPanelContribution,
  ThemeContribution
} from '@kisaki/extension-api'
import {
  configureExtensionSdkBridge,
  resetExtensionSdkBridge,
  type ExtensionSdkBridge
} from '@kisaki/extension-sdk/bridge'
import type { ExtensionRegistry } from './extension-registry'
import type { ExtensionHostRpcServer } from './rpc-server'

interface ActiveExtensionScope {
  extensionId: string
}

/**
 * Adapts the host runtime to the public @kisaki/extension-sdk bridge.
 */
export class ExtensionHostSdkBridge {
  private readonly executionScope = new AsyncLocalStorage<ActiveExtensionScope>()
  private readonly bridge: ExtensionSdkBridge

  constructor(
    private readonly registry: ExtensionRegistry,
    private readonly rpc: ExtensionHostRpcServer,
    private runtimeInfo: RuntimeInfo
  ) {
    this.bridge = this.createBridge()
  }

  configure(): void {
    configureExtensionSdkBridge(this.bridge)
  }

  dispose(): void {
    resetExtensionSdkBridge()
  }

  setRuntimeInfo(runtimeInfo: RuntimeInfo): void {
    this.runtimeInfo = runtimeInfo
  }

  runInExtensionContext<T>(extensionId: string, callback: () => Promise<T> | T): Promise<T> | T {
    return this.executionScope.run({ extensionId }, callback)
  }

  private createBridge(): ExtensionSdkBridge {
    return {
      api: this.createApi(),
      createLogger: (extension) => this.createLogger(extension),
      createStorage: (extension) => this.createStorage(extension),
      registerEntityMenu: (contribution) => this.registerEntityMenu(contribution),
      registerSettingsPanel: (contribution) => this.registerSettingsPanel(contribution),
      registerGameScraperProvider: (provider) => this.registerGameScraperProvider(provider),
      registerPersonScraperProvider: (provider) => this.registerPersonScraperProvider(provider),
      registerCompanyScraperProvider: (provider) => this.registerCompanyScraperProvider(provider),
      registerCharacterScraperProvider: (provider) =>
        this.registerCharacterScraperProvider(provider),
      registerDeeplink: (contribution) => this.registerDeeplink(contribution),
      registerTheme: (theme) => this.registerTheme(theme),
      asAbsolutePath: (extensionPath, relativePath) =>
        resolveInsideExtension(extensionPath, relativePath)
    }
  }

  private createApi(): KisakiApi {
    const notImplemented = (capability: string) => {
      throw new Error(`Kisaki capability "${capability}" is not available until phase 2C`)
    }

    const unavailableEntityNamespace = (capability: string) => ({
      get: async () => notImplemented(capability),
      list: async () => notImplemented(capability),
      create: async () => notImplemented(capability),
      update: async () => notImplemented(capability),
      remove: async () => notImplemented(capability)
    })

    return {
      library: {
        games: unavailableEntityNamespace('library.games'),
        characters: unavailableEntityNamespace('library.characters'),
        persons: unavailableEntityNamespace('library.persons'),
        companies: unavailableEntityNamespace('library.companies'),
        collections: unavailableEntityNamespace('library.collections'),
        tags: unavailableEntityNamespace('library.tags'),
        relations: {
          list: async () => notImplemented('library.relations'),
          create: async () => notImplemented('library.relations'),
          update: async () => notImplemented('library.relations'),
          remove: async () => notImplemented('library.relations')
        },
        attachments: {
          list: async () => notImplemented('library.attachments'),
          put: async () => notImplemented('library.attachments'),
          remove: async () => notImplemented('library.attachments')
        }
      },
      network: {
        request: async () => notImplemented('network'),
        download: async () => notImplemented('network')
      },
      notify: {
        success: async () => notImplemented('notify'),
        info: async () => notImplemented('notify'),
        warning: async () => notImplemented('notify'),
        error: async () => notImplemented('notify'),
        loading: async () => notImplemented('notify'),
        update: async () => notImplemented('notify'),
        dismiss: async () => notImplemented('notify')
      },
      events: {
        on: async () => notImplemented('events'),
        once: async () => notImplemented('events'),
        onExtension: async () => notImplemented('events'),
        emit: async () => notImplemented('events')
      },
      runtime: {
        getInfo: async () => this.getRuntimeInfoForCurrentExtension(),
        delay: async (ms: number) => {
          await new Promise((resolve) => setTimeout(resolve, ms))
        }
      }
    }
  }

  private createLogger(extension: ExtensionRuntimeMetadata): ExtensionLogger {
    const logWithLevel = (
      level: 'debug' | 'info' | 'warn' | 'error',
      message: string,
      args: unknown[]
    ) => {
      void this.rpc
        .requestMain('bridge.logger.log', {
          extensionId: extension.id,
          level,
          message,
          args: args.map((value) => toRpcValue(value))
        })
        .catch((error) => {
          console.warn(`[ExtensionHost][${extension.id}] Failed to forward ${level} log:`, error)
        })
    }

    return {
      debug: (message, ...args) => logWithLevel('debug', message, args),
      info: (message, ...args) => logWithLevel('info', message, args),
      warn: (message, ...args) => logWithLevel('warn', message, args),
      error: (message, ...args) => logWithLevel('error', message, args)
    }
  }

  private createStorage(extension: ExtensionRuntimeMetadata): ExtensionStorage {
    const rpc = this.rpc

    return {
      async get<T>(key: string, fallback: T): Promise<T> {
        const result = await rpc.requestMain('bridge.storage.get', {
          extensionId: extension.id,
          key,
          fallback: toSerializableValue(fallback, 'storage fallback')
        })

        return result.value as T
      },
      async set<T>(key: string, value: T): Promise<void> {
        await rpc.requestMain('bridge.storage.set', {
          extensionId: extension.id,
          key,
          value: toSerializableValue(value, 'storage value')
        })
      },
      async delete(key: string): Promise<void> {
        await rpc.requestMain('bridge.storage.delete', {
          extensionId: extension.id,
          key
        })
      },
      async listKeys(prefix?: string): Promise<readonly string[]> {
        const result = await rpc.requestMain('bridge.storage.listKeys', {
          extensionId: extension.id,
          prefix
        })

        return result.keys
      }
    }
  }

  private registerEntityMenu(contribution: EntityMenuContribution): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerEntityMenu(extensionId, contribution)
    this.fireAndForgetBridgeCall('bridge.entityMenus.register', {
      extensionId,
      contribution: {
        id: contribution.id,
        target: contribution.target,
        order: contribution.order
      }
    })

    return createDisposable(() => {
      this.registry.unregisterEntityMenu(extensionId, contribution.id)
      this.fireAndForgetBridgeCall('bridge.entityMenus.unregister', {
        extensionId,
        contributionId: contribution.id
      })
    })
  }

  private registerSettingsPanel(contribution: SettingsPanelContribution): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerSettingsPanel(extensionId, contribution)
    this.fireAndForgetBridgeCall('bridge.settingsPanels.register', {
      extensionId,
      contribution: {
        id: contribution.id,
        title: contribution.title,
        description: contribution.description,
        order: contribution.order
      }
    })

    return createDisposable(() => {
      this.registry.unregisterSettingsPanel(extensionId, contribution.id)
      this.fireAndForgetBridgeCall('bridge.settingsPanels.unregister', {
        extensionId,
        panelId: contribution.id
      })
    })
  }

  private registerGameScraperProvider(provider: GameScraperProvider): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerGameScraper(extensionId, provider)
    this.fireAndForgetBridgeCall('bridge.scrapers.games.register', {
      extensionId,
      provider: {
        id: provider.id,
        name: provider.name,
        capabilities: provider.capabilities
      }
    })

    return createDisposable(() => {
      this.registry.unregisterGameScraper(extensionId, provider.id)
      this.fireAndForgetBridgeCall('bridge.scrapers.games.unregister', {
        extensionId,
        providerId: provider.id
      })
    })
  }

  private registerPersonScraperProvider(provider: PersonScraperProvider): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerPersonScraper(extensionId, provider)
    this.fireAndForgetBridgeCall('bridge.scrapers.persons.register', {
      extensionId,
      provider: {
        id: provider.id,
        name: provider.name,
        capabilities: provider.capabilities
      }
    })

    return createDisposable(() => {
      this.registry.unregisterPersonScraper(extensionId, provider.id)
      this.fireAndForgetBridgeCall('bridge.scrapers.persons.unregister', {
        extensionId,
        providerId: provider.id
      })
    })
  }

  private registerCompanyScraperProvider(provider: CompanyScraperProvider): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerCompanyScraper(extensionId, provider)
    this.fireAndForgetBridgeCall('bridge.scrapers.companies.register', {
      extensionId,
      provider: {
        id: provider.id,
        name: provider.name,
        capabilities: provider.capabilities
      }
    })

    return createDisposable(() => {
      this.registry.unregisterCompanyScraper(extensionId, provider.id)
      this.fireAndForgetBridgeCall('bridge.scrapers.companies.unregister', {
        extensionId,
        providerId: provider.id
      })
    })
  }

  private registerCharacterScraperProvider(provider: CharacterScraperProvider): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerCharacterScraper(extensionId, provider)
    this.fireAndForgetBridgeCall('bridge.scrapers.characters.register', {
      extensionId,
      provider: {
        id: provider.id,
        name: provider.name,
        capabilities: provider.capabilities
      }
    })

    return createDisposable(() => {
      this.registry.unregisterCharacterScraper(extensionId, provider.id)
      this.fireAndForgetBridgeCall('bridge.scrapers.characters.unregister', {
        extensionId,
        providerId: provider.id
      })
    })
  }

  private registerDeeplink(contribution: DeeplinkContribution): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerDeeplink(extensionId, contribution)
    this.fireAndForgetBridgeCall('bridge.deeplinks.register', {
      extensionId,
      contribution: {
        id: contribution.id,
        route: contribution.route
      }
    })

    return createDisposable(() => {
      this.registry.unregisterDeeplink(extensionId, contribution.id)
      this.fireAndForgetBridgeCall('bridge.deeplinks.unregister', {
        extensionId,
        contributionId: contribution.id
      })
    })
  }

  private registerTheme(theme: ThemeContribution): Disposable {
    const extensionId = this.requireCurrentExtensionId()
    this.registry.registerTheme(extensionId, theme)
    this.fireAndForgetBridgeCall('bridge.themes.register', {
      extensionId,
      theme
    })

    return createDisposable(() => {
      this.registry.unregisterTheme(extensionId, theme.id)
      this.fireAndForgetBridgeCall('bridge.themes.unregister', {
        extensionId,
        themeId: theme.id
      })
    })
  }

  private fireAndForgetBridgeCall(
    method:
      | 'bridge.entityMenus.register'
      | 'bridge.entityMenus.unregister'
      | 'bridge.settingsPanels.register'
      | 'bridge.settingsPanels.unregister'
      | 'bridge.scrapers.games.register'
      | 'bridge.scrapers.games.unregister'
      | 'bridge.scrapers.persons.register'
      | 'bridge.scrapers.persons.unregister'
      | 'bridge.scrapers.companies.register'
      | 'bridge.scrapers.companies.unregister'
      | 'bridge.scrapers.characters.register'
      | 'bridge.scrapers.characters.unregister'
      | 'bridge.deeplinks.register'
      | 'bridge.deeplinks.unregister'
      | 'bridge.themes.register'
      | 'bridge.themes.unregister',
    params: unknown
  ): void {
    void this.rpc.requestMain(method, params as any).catch((error) => {
      console.warn(`[ExtensionHost] Failed to dispatch bridge request "${method}":`, error)
    })
  }

  private requireCurrentExtensionId(): string {
    const scope = this.executionScope.getStore()
    if (!scope?.extensionId) {
      throw new Error(
        'The Kisaki extension SDK bridge was used outside an active extension execution scope.'
      )
    }

    return scope.extensionId
  }

  private getRuntimeInfoForCurrentExtension(): RuntimeInfo {
    const extensionId = this.requireCurrentExtensionId()
    const runtime = this.registry.get(extensionId)

    return {
      ...this.runtimeInfo,
      mode: runtime?.metadata.mode ?? this.runtimeInfo.mode
    }
  }
}

function createDisposable(dispose: () => Promise<void> | void): Disposable {
  return { dispose }
}

function resolveInsideExtension(extensionPath: string, relativePath: string): string {
  const absolutePath = path.resolve(extensionPath, relativePath)
  const relative = path.relative(extensionPath, absolutePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Extension paths must stay within the extension directory')
  }

  return absolutePath
}

function toSerializableValue(
  value: unknown,
  label: string,
  seen = new Set<object>()
): SerializableValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      throw new Error(`${label} must not contain circular references`)
    }

    seen.add(value)
    const items = value.map((entry) => toSerializableValue(entry, label, seen))
    seen.delete(value)
    return items
  }

  if (value && typeof value === 'object') {
    if (seen.has(value)) {
      throw new Error(`${label} must not contain circular references`)
    }

    seen.add(value)
    const result: Record<string, SerializableValue> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toSerializableValue(entry, label, seen)
    }
    seen.delete(value)
    return result
  }

  throw new Error(`${label} must be JSON-serializable`)
}

function toRpcValue(value: unknown): RpcValue {
  if (value instanceof Uint8Array) {
    return value
  }

  if (value instanceof Error) {
    const serializedError: Record<string, string> = {
      name: value.name,
      message: value.message
    }

    if (value.stack) {
      serializedError.stack = value.stack
    }

    return serializedError
  }

  try {
    return toSerializableValue(value, 'log argument')
  } catch {
    return String(value)
  }
}

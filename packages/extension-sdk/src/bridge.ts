import type {
  CharacterScraperProvider,
  DeeplinkContribution,
  Disposable,
  DisposableStore,
  EntityMenuContribution,
  ExtensionContext,
  ExtensionLogger,
  ExtensionRuntimeMetadata,
  ExtensionStorage,
  GameScraperProvider,
  KisakiApi,
  PersonScraperProvider,
  CompanyScraperProvider,
  SettingsPanelContribution,
  ThemeContribution
} from '@kisaki/extension-api'
import { createDeeplinkRegistrar } from './contributions/deeplinks'
import { createEntityMenuRegistrar } from './contributions/entity-menus'
import { createScraperRegistrar } from './contributions/scrapers'
import { createSettingsPanelRegistrar } from './contributions/settings-panels'
import { createThemeRegistrar } from './contributions/themes'

export interface ExtensionSdkBridge {
  readonly api: KisakiApi
  createLogger(extension: ExtensionRuntimeMetadata): ExtensionLogger
  createStorage(extension: ExtensionRuntimeMetadata): ExtensionStorage
  registerEntityMenu(contribution: EntityMenuContribution): Disposable
  registerSettingsPanel(contribution: SettingsPanelContribution): Disposable
  registerGameScraperProvider(provider: GameScraperProvider): Disposable
  registerPersonScraperProvider(provider: PersonScraperProvider): Disposable
  registerCompanyScraperProvider(provider: CompanyScraperProvider): Disposable
  registerCharacterScraperProvider(provider: CharacterScraperProvider): Disposable
  registerDeeplink(contribution: DeeplinkContribution): Disposable
  registerTheme(theme: ThemeContribution): Disposable
  asAbsolutePath(extensionPath: string, relativePath: string): string
}

const EXTENSION_SDK_BRIDGE_KEY = Symbol.for('kisaki.extensionSdkBridge')

interface ExtensionSdkBridgeStore {
  bridge: ExtensionSdkBridge | null
}

function getBridgeStore(): ExtensionSdkBridgeStore {
  const globalObject = globalThis as typeof globalThis &
    Record<symbol, ExtensionSdkBridgeStore | undefined>
  let store = globalObject[EXTENSION_SDK_BRIDGE_KEY]

  if (!store) {
    store = { bridge: null }
    globalObject[EXTENSION_SDK_BRIDGE_KEY] = store
  }

  return store
}

class DisposableStoreImpl implements DisposableStore {
  private readonly disposables = new Set<Disposable>()

  get size(): number {
    return this.disposables.size
  }

  add<T extends Disposable>(disposable: T): T {
    this.disposables.add(disposable)
    return disposable
  }

  delete(disposable: Disposable): boolean {
    return this.disposables.delete(disposable)
  }

  async clear(): Promise<void> {
    const disposables = [...this.disposables]
    this.disposables.clear()

    for (const disposable of disposables.reverse()) {
      await disposable.dispose()
    }
  }

  async dispose(): Promise<void> {
    await this.clear()
  }
}

export interface ExtensionContextFactoryOptions {
  extension: ExtensionRuntimeMetadata
  abortSignal: AbortSignal
  subscriptions?: DisposableStore
}

export function configureExtensionSdkBridge(bridge: ExtensionSdkBridge): void {
  const store = getBridgeStore()

  if (store.bridge && store.bridge !== bridge) {
    throw new Error(
      'The Kisaki extension SDK bridge has already been configured for this process. ' +
        'Reset it explicitly before replacing the bridge instance.'
    )
  }

  store.bridge = bridge
}

export function resetExtensionSdkBridge(): void {
  getBridgeStore().bridge = null
}

export function getExtensionSdkBridge(): ExtensionSdkBridge {
  const bridge = getBridgeStore().bridge

  if (!bridge) {
    throw new Error(
      'The Kisaki extension SDK bridge has not been configured. ' +
        'The extension host must call configureExtensionSdkBridge(...) before loading extensions.'
    )
  }

  return bridge
}

export function createDisposableStore(): DisposableStore {
  return new DisposableStoreImpl()
}

export function createExtensionContext(options: ExtensionContextFactoryOptions): ExtensionContext {
  const bridge = getExtensionSdkBridge()
  const subscriptions = options.subscriptions ?? createDisposableStore()

  return {
    extension: options.extension,
    logger: bridge.createLogger(options.extension),
    storage: bridge.createStorage(options.extension),
    subscriptions,
    abortSignal: options.abortSignal,
    contributes: {
      entityMenus: createEntityMenuRegistrar(bridge, subscriptions),
      settingsPanels: createSettingsPanelRegistrar(bridge, subscriptions),
      scrapers: createScraperRegistrar(bridge, subscriptions),
      deeplinks: createDeeplinkRegistrar(bridge, subscriptions),
      themes: createThemeRegistrar(bridge, subscriptions)
    },
    asAbsolutePath(relativePath: string) {
      return bridge.asAbsolutePath(options.extension.extensionPath, relativePath)
    },
    registerDisposable(disposable: Disposable) {
      subscriptions.add(disposable)
    }
  }
}

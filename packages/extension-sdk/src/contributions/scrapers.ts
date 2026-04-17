import type {
  DisposableStore,
  ScraperRegistrar,
  GameScraperProvider,
  PersonScraperProvider,
  CompanyScraperProvider,
  CharacterScraperProvider
} from '@kisaki/extension-api'
import type { ExtensionSdkBridge } from '../bridge'

export function createScraperRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
): ScraperRegistrar {
  return {
    registerGameProvider(provider: GameScraperProvider) {
      const disposable = bridge.registerGameScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerPersonProvider(provider: PersonScraperProvider) {
      const disposable = bridge.registerPersonScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCompanyProvider(provider: CompanyScraperProvider) {
      const disposable = bridge.registerCompanyScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    },
    registerCharacterProvider(provider: CharacterScraperProvider) {
      const disposable = bridge.registerCharacterScraperProvider(provider)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

import type {
  DeeplinkContribution,
  DeeplinkRegistrar,
  DisposableStore
} from '@kisaki/extension-api'
import type { ExtensionSdkBridge } from '../bridge'

export function createDeeplinkRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
): DeeplinkRegistrar {
  return {
    register(contribution: DeeplinkContribution) {
      const disposable = bridge.registerDeeplink(contribution)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

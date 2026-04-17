import type { DisposableStore, ThemeContribution, ThemeRegistrar } from '@kisaki/extension-api'
import type { ExtensionSdkBridge } from '../bridge'

export function createThemeRegistrar(
  bridge: ExtensionSdkBridge,
  subscriptions: DisposableStore
): ThemeRegistrar {
  return {
    register(theme: ThemeContribution) {
      const disposable = bridge.registerTheme(theme)
      subscriptions.add(disposable)
      return disposable
    }
  }
}

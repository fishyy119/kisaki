import type { AccountService } from '../../auth/account'
import type { OAuthFlow } from '../../auth/oauth-flow'
import type { TokenService } from '../../auth/token-service'
import type { SettingsStore } from '../../config/store'
import type { MediaRegistry } from '../../media/registry'
import { PreviewResultRegistry } from './shared/previews'

export interface BangumiSettingsPanelDependencies {
  settingsStore: SettingsStore
  accountService: AccountService
  oauthFlow: OAuthFlow
  tokenService: TokenService
  mediaRegistry: MediaRegistry
}

export interface BangumiSettingsRuntime extends BangumiSettingsPanelDependencies {
  previewRegistry: PreviewResultRegistry
}

export function createSettingsRuntime(
  dependencies: BangumiSettingsPanelDependencies
): BangumiSettingsRuntime {
  return {
    ...dependencies,
    previewRegistry: new PreviewResultRegistry()
  }
}

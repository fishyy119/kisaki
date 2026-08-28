import { kisaki } from '@kisaki3/extension-sdk'
import type {
  SteamAccountState,
  SteamAccountVerification,
  SteamImportRequest,
  SteamProfileOption,
  SteamSettingsFormState,
  SteamSettingsHostFunctions,
  SteamSettingsOverview,
  SteamTaskStateView
} from '../../shared/settings'
import { STEAM_API_KEY_PAGE_URL } from '../../shared/settings'
import { m } from '../i18n'
import { SteamExtensionError } from '../utils/errors'
import { applyFormState, toFormState } from './forms'
import type { SteamSettingsRuntime } from './runtime'

export function createSteamSettingsHostFunctions(
  runtime: SteamSettingsRuntime
): SteamSettingsHostFunctions {
  const readAccountState = async (): Promise<SteamAccountState> => ({
    keyConfigured: await runtime.client.hasWebApiKey()
  })

  return {
    async getOverview(): Promise<SteamSettingsOverview> {
      const [settings, account] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState()
      ])
      return { form: toFormState(settings), account }
    },

    async saveSettings(form: SteamSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async saveApiKey(key: string): Promise<SteamAccountState> {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new SteamExtensionError('key_rejected', m().errors.keyEmpty)
      }

      await runtime.client.setWebApiKey(trimmed)
      return readAccountState()
    },

    async clearApiKey(): Promise<SteamAccountState> {
      await runtime.client.clearWebApiKey()
      return readAccountState()
    },

    async verifyAccount(): Promise<SteamAccountVerification> {
      const games = await runtime.client.getOwnedGames({ signal: runtime.abortSignal })
      return { gameCount: games.length }
    },

    async listGameProfiles(): Promise<SteamProfileOption[]> {
      const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'game' })
      return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
    },

    async startImport(request: SteamImportRequest): Promise<{ runId: string }> {
      return runtime.tasks.startImport({ profileId: request.profileId })
    },

    async getTaskState(runId: string): Promise<SteamTaskStateView | null> {
      return runtime.tasks.getTaskState(runId)
    },

    async cancelTask(runId: string): Promise<boolean> {
      return runtime.tasks.cancelTask(runId)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    },

    async openExternal(url: string): Promise<void> {
      // The webview states intent; the host owns the allowed destinations.
      await kisaki.runtime.openExternal(
        url === STEAM_API_KEY_PAGE_URL ? url : STEAM_API_KEY_PAGE_URL
      )
    }
  }
}

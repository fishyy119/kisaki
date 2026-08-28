import { kisaki } from '@kisaki3/extension-sdk'
import type {
  MangadexAccountState,
  MangadexAccountVerification,
  MangadexCredentialsInput,
  MangadexImportRequest,
  MangadexProfileOption,
  MangadexSettingsFormState,
  MangadexSettingsHostFunctions,
  MangadexSettingsOverview,
  MangadexTaskStateView
} from '../../shared/settings'
import { m } from '../i18n'
import { MANGADEX_CLIENT_SETTINGS_URL } from '../utils/constants'
import { MangadexExtensionError } from '../utils/errors'
import type { ImportOptions } from '../import/runner'
import { applyFormState, toFormState } from './forms'
import type { MangadexSettingsRuntime } from './runtime'

export function createMangadexSettingsHostFunctions(
  runtime: MangadexSettingsRuntime
): MangadexSettingsHostFunctions {
  const readAccountState = async (): Promise<MangadexAccountState> => ({
    configured: await runtime.tokenManager.hasCredentials()
  })

  const verifyAccount = async (): Promise<MangadexAccountVerification> => {
    const user = await runtime.client.getOwnUser({ signal: runtime.abortSignal })
    return { userId: user.id, userName: user.attributes?.username?.trim() || user.id }
  }

  return {
    async getOverview(): Promise<MangadexSettingsOverview> {
      const [settings, account] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState()
      ])
      return { form: toFormState(settings), account }
    },

    async saveSettings(form: MangadexSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async saveCredentials(input: MangadexCredentialsInput): Promise<MangadexAccountVerification> {
      const clientId = input.clientId.trim()
      const clientSecret = input.clientSecret.trim()
      const username = input.username.trim()
      const password = input.password
      if (!clientId || !clientSecret || !username || !password) {
        throw new MangadexExtensionError('credentials_incomplete', m().errors.credentialsIncomplete)
      }

      await runtime.tokenManager.signIn(
        { version: 1, clientId, clientSecret, username, password },
        runtime.abortSignal
      )
      return verifyAccount()
    },

    async clearCredentials(): Promise<MangadexAccountState> {
      await runtime.credentialsStore.clearAll()
      return readAccountState()
    },

    verifyAccount,

    async listComicProfiles(): Promise<MangadexProfileOption[]> {
      const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'comic' })
      return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
    },

    async startImport(request: MangadexImportRequest): Promise<{ runId: string }> {
      const options: ImportOptions = {
        updateExisting: request.updateExisting,
        createMissing: request.createMissing,
        importScores: request.importScores,
        ...(request.profileId ? { profileId: request.profileId } : {})
      }
      return runtime.tasks.startImport(options)
    },

    async startPushAll(): Promise<{ runId: string }> {
      return runtime.tasks.startPushAll()
    },

    async getTaskState(runId: string): Promise<MangadexTaskStateView | null> {
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
        url === MANGADEX_CLIENT_SETTINGS_URL ? url : MANGADEX_CLIENT_SETTINGS_URL
      )
    }
  }
}

import { kisaki } from '@kisaki3/extension-sdk'
import type {
  TmdbCredentialState,
  TmdbSettingsFormState,
  TmdbSettingsHostFunctions,
  TmdbSettingsOverview
} from '../../shared/settings'
import { detectTmdbAuthMode } from '../auth/api-key'
import { m } from '../i18n'
import { TmdbExtensionError, toSafeErrorLog } from '../utils/errors'
import { applyFormState, toFormState } from './forms'
import type { TmdbSettingsRuntime } from './runtime'

/** RPC façade exposed to the settings webview. */
export function createTmdbSettingsHostFunctions(
  runtime: TmdbSettingsRuntime
): TmdbSettingsHostFunctions {
  const readCredentialState = async (): Promise<TmdbCredentialState> => {
    const credential = await runtime.apiKeys.getCredential()
    return credential
      ? { configured: true, mode: credential.mode }
      : { configured: false, mode: null }
  }

  return {
    async getOverview(): Promise<TmdbSettingsOverview> {
      const [settings, credential] = await Promise.all([
        runtime.settingsStore.get(),
        readCredentialState()
      ])

      return { form: toFormState(settings), credential }
    },

    async saveSettings(form: TmdbSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async saveApiKey(key: string): Promise<TmdbCredentialState> {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new TmdbExtensionError('api_key_missing', m().errors.apiKeyRequired)
      }

      await runtime.apiKeys.set(trimmed)
      return { configured: true, mode: detectTmdbAuthMode(trimmed) }
    },

    async clearApiKey(): Promise<TmdbCredentialState> {
      await runtime.apiKeys.clear()
      return { configured: false, mode: null }
    },

    async testConnection(): Promise<void> {
      try {
        await runtime.client.verifyCredential(runtime.abortSignal)
      } catch (error) {
        // The webview shows what the user can act on; the cause stays here.
        runtime.logger.warn('TMDB connection test failed.', toSafeErrorLog(error))
        throw error
      }
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    },

    async openExternal(url: string): Promise<void> {
      await kisaki.runtime.openExternal(url)
    }
  }
}

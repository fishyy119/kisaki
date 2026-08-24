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
      await notifySuccess(runtime, m().ui.saved)
    },

    async saveApiKey(key: string): Promise<TmdbCredentialState> {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new TmdbExtensionError('api_key_missing', m().errors.apiKeyRequired)
      }

      await runtime.apiKeys.set(trimmed)
      await notifySuccess(runtime, m().ui.credentials.saveSucceeded)
      return { configured: true, mode: detectTmdbAuthMode(trimmed) }
    },

    async clearApiKey(): Promise<TmdbCredentialState> {
      await runtime.apiKeys.clear()
      await notifySuccess(runtime, m().ui.credentials.clearSucceeded)
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

      await notifySuccess(runtime, m().ui.credentials.testSucceeded)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
      await notifySuccess(runtime, m().ui.preferences.resetSucceeded)
    },

    async openExternal(url: string): Promise<void> {
      await kisaki.runtime.openExternal(url)
    }
  }
}

/**
 * Results are reported through the app's own notification surface, so an
 * extension action reads exactly like a native one. A failed notification is
 * cosmetic and must not fail the action that already succeeded.
 */
async function notifySuccess(runtime: TmdbSettingsRuntime, title: string): Promise<void> {
  try {
    await kisaki.notify.success(title)
  } catch (error) {
    runtime.logger.warn('TMDB notification failed.', toSafeErrorLog(error))
  }
}

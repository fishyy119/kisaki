import { kisaki } from '@kisaki3/extension-sdk'
import type {
  VndbCredentialState,
  VndbSettingsFormState,
  VndbSettingsHostFunctions,
  VndbSettingsOverview
} from '../../shared/settings'
import { m } from '../i18n'
import { VndbExtensionError, toSafeErrorLog } from '../utils/errors'
import { applyFormState, toFormState } from './forms'
import type { VndbSettingsRuntime } from './runtime'

/** RPC façade exposed to the settings webview. */
export function createVndbSettingsHostFunctions(
  runtime: VndbSettingsRuntime
): VndbSettingsHostFunctions {
  const readCredentialState = async (): Promise<VndbCredentialState> => ({
    configured: await runtime.tokens.has()
  })

  return {
    async getOverview(): Promise<VndbSettingsOverview> {
      const [settings, credential] = await Promise.all([
        runtime.settingsStore.get(),
        readCredentialState()
      ])

      return { form: toFormState(settings), credential }
    },

    async saveSettings(form: VndbSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
      await notifySuccess(runtime, m().ui.saved)
    },

    async saveToken(token: string): Promise<VndbCredentialState> {
      const trimmed = token.trim()
      if (!trimmed) {
        throw new VndbExtensionError('token_required', m().errors.tokenRequired)
      }

      await runtime.tokens.set(trimmed)
      await notifySuccess(runtime, m().ui.credentials.saveSucceeded)
      return { configured: true }
    },

    async clearToken(): Promise<VndbCredentialState> {
      await runtime.tokens.clear()
      await notifySuccess(runtime, m().ui.credentials.clearSucceeded)
      return { configured: false }
    },

    async testConnection(): Promise<void> {
      try {
        await runtime.client.verifyConnection(runtime.abortSignal)
      } catch (error) {
        // The webview shows what the user can act on; the cause stays here.
        runtime.logger.warn('VNDB connection test failed.', toSafeErrorLog(error))
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
async function notifySuccess(runtime: VndbSettingsRuntime, title: string): Promise<void> {
  try {
    await kisaki.notify.success(title)
  } catch (error) {
    runtime.logger.warn('VNDB notification failed.', toSafeErrorLog(error))
  }
}

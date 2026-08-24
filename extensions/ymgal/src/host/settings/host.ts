import { kisaki } from '@kisaki3/extension-sdk'
import type {
  YmgalCredentialState,
  YmgalSettingsFormState,
  YmgalSettingsHostFunctions,
  YmgalSettingsOverview
} from '../../shared/settings'
import { m } from '../i18n'
import { YmgalExtensionError, toSafeErrorLog } from '../utils/errors'
import { applyFormState, toFormState } from './forms'
import type { YmgalSettingsRuntime } from './runtime'

/** RPC façade exposed to the settings webview. */
export function createYmgalSettingsHostFunctions(
  runtime: YmgalSettingsRuntime
): YmgalSettingsHostFunctions {
  const readCredentialState = async (): Promise<YmgalCredentialState> => {
    const credential = await runtime.credentials.getCredential()
    return { configured: credential.isCustom, clientId: credential.clientId }
  }

  return {
    async getOverview(): Promise<YmgalSettingsOverview> {
      const [settings, credential] = await Promise.all([
        runtime.settingsStore.get(),
        readCredentialState()
      ])

      return { form: toFormState(settings), credential }
    },

    async saveSettings(form: YmgalSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
      await notifySuccess(runtime, m().ui.saved)
    },

    async saveCredential(clientId: string, clientSecret: string): Promise<YmgalCredentialState> {
      const id = clientId.trim()
      const secret = clientSecret.trim()
      if (!id || !secret) {
        throw new YmgalExtensionError('credential_required', m().errors.credentialRequired)
      }

      await runtime.credentials.set(id, secret)
      // The cached token belongs to the previous client and would keep
      // authenticating as it until it expired.
      runtime.client.invalidateToken()
      await notifySuccess(runtime, m().ui.credentials.saveSucceeded)
      return readCredentialState()
    },

    async clearCredential(): Promise<YmgalCredentialState> {
      await runtime.credentials.clear()
      runtime.client.invalidateToken()
      await notifySuccess(runtime, m().ui.credentials.clearSucceeded)
      return readCredentialState()
    },

    async testConnection(): Promise<void> {
      try {
        await runtime.client.verifyCredential(runtime.abortSignal)
      } catch (error) {
        // The webview shows what the user can act on; the cause stays here.
        runtime.logger.warn('YMGal connection test failed.', toSafeErrorLog(error))
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
async function notifySuccess(runtime: YmgalSettingsRuntime, title: string): Promise<void> {
  try {
    await kisaki.notify.success(title)
  } catch (error) {
    runtime.logger.warn('YMGal notification failed.', toSafeErrorLog(error))
  }
}

import { kisaki } from '@kisaki3/extension-sdk'
import type {
  IgdbCredentialState,
  IgdbSettingsFormState,
  IgdbSettingsHostFunctions,
  IgdbSettingsOverview
} from '../../shared/settings'
import { m } from '../i18n'
import { IgdbExtensionError, toSafeErrorLog } from '../utils/errors'
import { applyFormState, toFormState } from './forms'
import type { IgdbSettingsRuntime } from './runtime'

/** RPC façade exposed to the settings webview. */
export function createIgdbSettingsHostFunctions(
  runtime: IgdbSettingsRuntime
): IgdbSettingsHostFunctions {
  const readCredentialState = async (): Promise<IgdbCredentialState> => {
    const credential = await runtime.credentials.getCredential()
    return credential
      ? { configured: true, clientId: credential.clientId }
      : { configured: false, clientId: null }
  }

  return {
    async getOverview(): Promise<IgdbSettingsOverview> {
      const [settings, credential] = await Promise.all([
        runtime.settingsStore.get(),
        readCredentialState()
      ])

      return { form: toFormState(settings), credential }
    },

    async saveSettings(form: IgdbSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
      await notifySuccess(runtime, m().ui.saved)
    },

    async saveCredential(clientId: string, clientSecret: string): Promise<IgdbCredentialState> {
      const id = clientId.trim()
      const secret = clientSecret.trim()
      if (!id || !secret) {
        throw new IgdbExtensionError('credential_required', m().errors.credentialRequired)
      }

      await runtime.credentials.set(id, secret)
      // The cached token belongs to the previous client and would keep
      // authenticating as it until it expired.
      runtime.client.invalidateToken()
      await notifySuccess(runtime, m().ui.credentials.saveSucceeded)
      return readCredentialState()
    },

    async clearCredential(): Promise<IgdbCredentialState> {
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
        runtime.logger.warn('IGDB connection test failed.', toSafeErrorLog(error))
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
async function notifySuccess(runtime: IgdbSettingsRuntime, title: string): Promise<void> {
  try {
    await kisaki.notify.success(title)
  } catch (error) {
    runtime.logger.warn('IGDB notification failed.', toSafeErrorLog(error))
  }
}

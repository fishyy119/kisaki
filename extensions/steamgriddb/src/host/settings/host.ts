import { kisaki } from '@kisaki3/extension-sdk'
import type {
  SgdbAccountState,
  SgdbSettingsFormState,
  SgdbSettingsHostFunctions,
  SgdbSettingsOverview
} from '../../shared/settings'
import { SGDB_API_KEY_PAGE_URL } from '../../shared/settings'
import { m } from '../i18n'
import { SgdbExtensionError } from '../utils/errors'
import { applyFormState, toFormState } from './forms'
import type { SgdbSettingsRuntime } from './runtime'

export function createSgdbSettingsHostFunctions(
  runtime: SgdbSettingsRuntime
): SgdbSettingsHostFunctions {
  const readAccountState = async (): Promise<SgdbAccountState> => ({
    keyConfigured: await runtime.client.hasApiKey()
  })

  return {
    async getOverview(): Promise<SgdbSettingsOverview> {
      const [settings, account] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState()
      ])
      return { form: toFormState(settings), account }
    },

    async saveSettings(form: SgdbSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async saveApiKey(key: string): Promise<SgdbAccountState> {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new SgdbExtensionError('key_rejected', m().errors.keyEmpty)
      }

      await runtime.client.setApiKey(trimmed)
      try {
        // A rejected key must not stay stored as if it worked.
        await runtime.client.searchGames('probe', { signal: runtime.abortSignal })
      } catch (error) {
        await runtime.client.clearApiKey()
        throw error
      }
      return readAccountState()
    },

    async clearApiKey(): Promise<SgdbAccountState> {
      await runtime.client.clearApiKey()
      return readAccountState()
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    },

    async openExternal(url: string): Promise<void> {
      // The webview states intent; the host owns the allowed destinations.
      await kisaki.runtime.openExternal(url === SGDB_API_KEY_PAGE_URL ? url : SGDB_API_KEY_PAGE_URL)
    }
  }
}

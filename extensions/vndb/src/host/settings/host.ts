import { kisaki } from '@kisaki3/extension-sdk'
import type {
  VndbAccountVerification,
  VndbAutomationKind,
  VndbCredentialState,
  VndbGameProfileOption,
  VndbImportRequest,
  VndbSettingsFormState,
  VndbSettingsHostFunctions,
  VndbSettingsOverview,
  VndbTaskStateView
} from '../../shared/settings'
import { m } from '../i18n'
import { VndbExtensionError, toSafeErrorLog } from '../utils/errors'
import { createVndbAutomation, resolveAutomationStates } from './automations'
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
      const [settings, credential, automations, runningOperations] = await Promise.all([
        runtime.settingsStore.get(),
        readCredentialState(),
        resolveAutomationStates(),
        listRunningOperations()
      ])

      return { form: toFormState(settings), credential, automations, runningOperations }
    },

    async saveSettings(form: VndbSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async saveToken(token: string): Promise<VndbCredentialState> {
      const trimmed = token.trim()
      if (!trimmed) {
        throw new VndbExtensionError('token_required', m().errors.tokenRequired)
      }

      await runtime.tokens.set(trimmed)
      return { configured: true }
    },

    async clearToken(): Promise<VndbCredentialState> {
      await runtime.tokens.clear()
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
    },

    async verifyAccount(): Promise<VndbAccountVerification> {
      try {
        const auth = await runtime.client.getAuthInfo({ signal: runtime.abortSignal })
        const permissions = auth.permissions ?? []
        return {
          userId: auth.id,
          username: auth.username,
          listRead: permissions.includes('listread'),
          listWrite: permissions.includes('listwrite')
        }
      } catch (error) {
        runtime.logger.warn('VNDB account verification failed.', toSafeErrorLog(error))
        throw error
      }
    },

    async listGameProfiles(): Promise<VndbGameProfileOption[]> {
      const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'game' })
      return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
    },

    async startImport(request: VndbImportRequest): Promise<{ runId: string }> {
      return runtime.tasks.startImport({
        updateExisting: request.updateExisting,
        createMissing: request.createMissing,
        ...(request.profileId ? { profileId: request.profileId } : {})
      })
    },

    async startPushAll(): Promise<{ runId: string }> {
      return runtime.tasks.startPushAll()
    },

    async getTaskState(runId: string): Promise<VndbTaskStateView | null> {
      return runtime.tasks.getTaskState(runId)
    },

    async cancelTask(runId: string): Promise<boolean> {
      return runtime.tasks.cancelTask(runId)
    },

    async createAutomation(kind: VndbAutomationKind): Promise<void> {
      await createVndbAutomation(kind)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    },

    async openExternal(url: string): Promise<void> {
      await kisaki.runtime.openExternal(url)
    }
  }
}

async function listRunningOperations(): Promise<readonly string[]> {
  const active = await kisaki.taskRuns.listActiveOwn({ limit: 20 }).catch(() => [])
  return active.map((run) => run.operation)
}

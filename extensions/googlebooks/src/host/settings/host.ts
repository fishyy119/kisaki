import { kisaki } from '@kisaki3/extension-sdk'
import type {
  GbooksAccountState,
  GbooksAutomationKind,
  GbooksImportRequest,
  GbooksProfileOption,
  GbooksProfileOptions,
  GbooksSettingsFormState,
  GbooksSettingsHostFunctions,
  GbooksSettingsOverview,
  GbooksTaskStateView
} from '../../shared/settings'
import { m } from '../i18n'
import { GbooksExtensionError } from '../utils/errors'
import type { ImportOptions } from '../import/runner'
import { createGbooksAutomation, resolveAutomationStates } from './automations'
import { applyFormState, toFormState } from './forms'
import type { GbooksSettingsRuntime } from './runtime'

export function createGbooksSettingsHostFunctions(
  runtime: GbooksSettingsRuntime
): GbooksSettingsHostFunctions {
  const readAccountState = async (): Promise<GbooksAccountState> => {
    const [token, apiKey, pending] = await Promise.all([
      runtime.tokenStore.getToken(),
      runtime.tokenStore.getApiKey(),
      runtime.oauthFlow.getPendingSessionStatus()
    ])

    const state: GbooksAccountState = {
      configured: token !== undefined,
      apiKeyConfigured: apiKey !== undefined,
      loginPending: pending.pending && !pending.expired
    }
    if (token?.expiresAt !== undefined) {
      state.expiresAt = token.expiresAt
    }
    return state
  }

  return {
    async getOverview(): Promise<GbooksSettingsOverview> {
      const [settings, account, automations, runningOperations] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState(),
        resolveAutomationStates(),
        listRunningOperations()
      ])
      return { form: toFormState(settings), account, automations, runningOperations }
    },

    async saveSettings(form: GbooksSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async startLogin(): Promise<GbooksAccountState> {
      await runtime.oauthFlow.startLogin(runtime.abortSignal)
      return readAccountState()
    },

    async completePendingLogin(): Promise<GbooksAccountState> {
      await runtime.oauthFlow.completePending(runtime.abortSignal)
      return readAccountState()
    },

    async cancelPendingLogin(): Promise<GbooksAccountState> {
      await runtime.oauthFlow.cancelPending()
      return readAccountState()
    },

    async logout(): Promise<GbooksAccountState> {
      await runtime.tokenStore.clearAuthSecrets()
      return readAccountState()
    },

    async saveApiKey(key: string): Promise<GbooksAccountState> {
      const trimmed = key.trim()
      if (!trimmed) {
        throw new GbooksExtensionError('gbooks_rejected', m().errors.keyEmpty)
      }

      await runtime.tokenStore.setApiKey(trimmed)
      return readAccountState()
    },

    async clearApiKey(): Promise<GbooksAccountState> {
      await runtime.tokenStore.deleteApiKey()
      return readAccountState()
    },

    async listProfileOptions(): Promise<GbooksProfileOptions> {
      const [novel, comic] = await Promise.all([listProfiles('novel'), listProfiles('comic')])
      return { novel, comic }
    },

    async startImport(request: GbooksImportRequest): Promise<{ runId: string }> {
      const options: ImportOptions = {
        includeEbooks: request.includeEbooks,
        includeReadingShelves: request.includeReadingShelves,
        updateExisting: request.updateExisting,
        createMissing: request.createMissing,
        mergeSeries: request.mergeSeries,
        ...(request.novelProfileId ? { novelProfileId: request.novelProfileId } : {}),
        ...(request.comicProfileId ? { comicProfileId: request.comicProfileId } : {})
      }
      return runtime.tasks.startImport(options)
    },

    async getTaskState(runId: string): Promise<GbooksTaskStateView | null> {
      return runtime.tasks.getTaskState(runId)
    },

    async cancelTask(runId: string): Promise<boolean> {
      return runtime.tasks.cancelTask(runId)
    },

    async createAutomation(kind: GbooksAutomationKind): Promise<void> {
      await createGbooksAutomation(kind)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    }
  }
}

async function listProfiles(mediaType: 'novel' | 'comic'): Promise<GbooksProfileOption[]> {
  const profiles = await kisaki.scrapers.profiles.list({ mediaType })
  return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
}

async function listRunningOperations(): Promise<readonly string[]> {
  const active = await kisaki.taskRuns.listActiveOwn({ limit: 20 }).catch(() => [])
  return active.map((run) => run.operation)
}

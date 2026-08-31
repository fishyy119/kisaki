import { kisaki } from '@kisaki3/extension-sdk'
import type {
  MalAccountState,
  MalAccountVerification,
  MalAutomationKind,
  MalImportRequest,
  MalProfileOption,
  MalProfileOptions,
  MalSettingsFormState,
  MalSettingsHostFunctions,
  MalSettingsOverview,
  MalTaskStateView
} from '../../shared/settings'
import type { ImportOptions } from '../import/runner'
import { createMalAutomation, resolveAutomationStates } from './automations'
import { applyFormState, toFormState } from './forms'
import type { MalSettingsRuntime } from './runtime'

export function createMalSettingsHostFunctions(
  runtime: MalSettingsRuntime
): MalSettingsHostFunctions {
  const readAccountState = async (): Promise<MalAccountState> => {
    const [token, pending] = await Promise.all([
      runtime.tokenStore.getToken(),
      runtime.oauthFlow.getPendingStatus()
    ])

    const state: MalAccountState = {
      configured: token !== undefined,
      loginPending: pending.pending && !pending.expired
    }
    if (token) {
      state.expiresAt = token.expiresAt
    }
    return state
  }

  return {
    async getOverview(): Promise<MalSettingsOverview> {
      const [settings, account, automations, runningOperations] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState(),
        resolveAutomationStates(),
        listRunningOperations()
      ])
      return { form: toFormState(settings), account, automations, runningOperations }
    },

    async saveSettings(form: MalSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async startLogin(): Promise<MalAccountState> {
      await runtime.oauthFlow.startLogin()
      return readAccountState()
    },

    async cancelPendingLogin(): Promise<MalAccountState> {
      await runtime.oauthFlow.cancelPending()
      return readAccountState()
    },

    async logout(): Promise<MalAccountState> {
      await runtime.tokenStore.clearAuthSecrets()
      return readAccountState()
    },

    async verifyAccount(): Promise<MalAccountVerification> {
      const user = await runtime.client.getOwnUser({ signal: runtime.abortSignal })
      return { userId: user.id, userName: user.name?.trim() || String(user.id) }
    },

    async listProfileOptions(): Promise<MalProfileOptions> {
      const [anime, comic, novel] = await Promise.all([
        listProfiles('anime'),
        listProfiles('comic'),
        listProfiles('novel')
      ])
      return { anime, comic, novel }
    },

    async startImport(request: MalImportRequest): Promise<{ runId: string }> {
      const options: ImportOptions = {
        lists: request.lists,
        updateExisting: request.updateExisting,
        createMissing: request.createMissing,
        profileIds: {
          ...(request.animeProfileId ? { anime: request.animeProfileId } : {}),
          ...(request.comicProfileId ? { comic: request.comicProfileId } : {}),
          ...(request.novelProfileId ? { novel: request.novelProfileId } : {})
        }
      }
      return runtime.tasks.startImport(options)
    },

    async startPushAll(): Promise<{ runId: string }> {
      return runtime.tasks.startPushAll()
    },

    async getTaskState(runId: string): Promise<MalTaskStateView | null> {
      return runtime.tasks.getTaskState(runId)
    },

    async cancelTask(runId: string): Promise<boolean> {
      return runtime.tasks.cancelTask(runId)
    },

    async createAutomation(kind: MalAutomationKind): Promise<void> {
      await createMalAutomation(kind)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    },

    async openExternal(url: string): Promise<void> {
      await kisaki.runtime.openExternal(url)
    }
  }
}

async function listProfiles(mediaType: 'anime' | 'comic' | 'novel'): Promise<MalProfileOption[]> {
  const profiles = await kisaki.scrapers.profiles.list({ mediaType })
  return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
}

async function listRunningOperations(): Promise<readonly string[]> {
  const active = await kisaki.taskRuns.listActiveOwn({ limit: 20 }).catch(() => [])
  return active.map((run) => run.operation)
}

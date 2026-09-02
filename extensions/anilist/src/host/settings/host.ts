import { kisaki } from '@kisaki3/extension-sdk'
import type {
  AnilistAccountState,
  AnilistAccountVerification,
  AnilistAutomationKind,
  AnilistImportRequest,
  AnilistProfileOption,
  AnilistProfileOptions,
  AnilistSettingsFormState,
  AnilistSettingsHostFunctions,
  AnilistSettingsOverview,
  AnilistTaskStateView
} from '../../shared/settings'
import type { ImportOptions } from '../import/runner'
import { createAnilistAutomation, resolveAutomationStates } from './automations'
import { applyFormState, toFormState } from './forms'
import type { AnilistSettingsRuntime } from './runtime'

export function createAnilistSettingsHostFunctions(
  runtime: AnilistSettingsRuntime
): AnilistSettingsHostFunctions {
  const readAccountState = async (): Promise<AnilistAccountState> => {
    const [token, pending] = await Promise.all([
      runtime.tokenStore.getToken(),
      runtime.oauthFlow.getPendingSessionStatus()
    ])

    const state: AnilistAccountState = {
      configured: token !== undefined,
      loginPending: pending.pending && !pending.expired
    }
    if (token?.expiresAt !== undefined) {
      state.expiresAt = token.expiresAt
    }
    return state
  }

  return {
    async getOverview(): Promise<AnilistSettingsOverview> {
      const [settings, account, automations, runningOperations] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState(),
        resolveAutomationStates(),
        listRunningOperations()
      ])
      return { form: toFormState(settings), account, automations, runningOperations }
    },

    async saveSettings(form: AnilistSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async startLogin(): Promise<AnilistAccountState> {
      await runtime.oauthFlow.startLogin(runtime.abortSignal)
      return readAccountState()
    },

    async completePendingLogin(): Promise<AnilistAccountState> {
      await runtime.oauthFlow.completePending(runtime.abortSignal)
      return readAccountState()
    },

    async reopenPendingAuthorize(): Promise<AnilistAccountState> {
      await runtime.oauthFlow.reopenPendingAuthorize()
      return readAccountState()
    },

    async cancelPendingLogin(): Promise<AnilistAccountState> {
      await runtime.oauthFlow.cancelPending()
      return readAccountState()
    },

    async logout(): Promise<AnilistAccountState> {
      await runtime.tokenStore.clearAuthSecrets()
      return readAccountState()
    },

    async verifyAccount(): Promise<AnilistAccountVerification> {
      const viewer = await runtime.client.getViewer({ signal: runtime.abortSignal })
      return { userId: viewer.id, userName: viewer.name?.trim() || String(viewer.id) }
    },

    async listProfileOptions(): Promise<AnilistProfileOptions> {
      const [anime, comic, novel] = await Promise.all([
        listProfiles('anime'),
        listProfiles('comic'),
        listProfiles('novel')
      ])
      return { anime, comic, novel }
    },

    async startImport(request: AnilistImportRequest): Promise<{ runId: string }> {
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

    async getTaskState(runId: string): Promise<AnilistTaskStateView | null> {
      return runtime.tasks.getTaskState(runId)
    },

    async cancelTask(runId: string): Promise<boolean> {
      return runtime.tasks.cancelTask(runId)
    },

    async createAutomation(kind: AnilistAutomationKind): Promise<void> {
      await createAnilistAutomation(kind)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    },

    async openExternal(url: string): Promise<void> {
      await kisaki.runtime.openExternal(url)
    }
  }
}

async function listProfiles(
  mediaType: 'anime' | 'comic' | 'novel'
): Promise<AnilistProfileOption[]> {
  const profiles = await kisaki.scrapers.profiles.list({ entityType: mediaType })
  return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
}

async function listRunningOperations(): Promise<readonly string[]> {
  const active = await kisaki.taskRuns.listActiveOwn({ limit: 20 }).catch(() => [])
  return active.map((run) => run.operation)
}

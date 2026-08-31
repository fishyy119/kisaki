import { kisaki } from '@kisaki3/extension-sdk'
import type {
  NeodbAccountState,
  NeodbAccountVerification,
  NeodbAutomationKind,
  NeodbImportRequest,
  NeodbProfileOption,
  NeodbSettingsFormState,
  NeodbSettingsHostFunctions,
  NeodbSettingsOverview,
  NeodbTaskStateView
} from '../../shared/settings'
import type { ImportOptions } from '../import/runner'
import { createNeodbAutomation, resolveAutomationStates } from './automations'
import { applyFormState, toFormState } from './forms'
import type { NeodbSettingsRuntime } from './runtime'

export function createNeodbSettingsHostFunctions(
  runtime: NeodbSettingsRuntime
): NeodbSettingsHostFunctions {
  const readAccountState = async (): Promise<NeodbAccountState> => {
    const [session, pending] = await Promise.all([
      runtime.sessionStore.getSession(),
      runtime.oauthFlow.getPendingStatus()
    ])

    const state: NeodbAccountState = {
      configured: session !== undefined,
      loginPending: pending.pending && !pending.expired,
      loginManual: pending.manual
    }
    if (session) {
      state.instanceUrl = session.instanceUrl
    }
    return state
  }

  return {
    async getOverview(): Promise<NeodbSettingsOverview> {
      const [settings, account, automations, runningOperations] = await Promise.all([
        runtime.settingsStore.get(),
        readAccountState(),
        resolveAutomationStates(),
        listRunningOperations()
      ])
      return { form: toFormState(settings), account, automations, runningOperations }
    },

    async saveSettings(form: NeodbSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async startLogin(): Promise<NeodbAccountState> {
      await runtime.oauthFlow.startLogin({ manual: false }, runtime.abortSignal)
      return readAccountState()
    },

    async startManualLogin(): Promise<NeodbAccountState> {
      await runtime.oauthFlow.startLogin({ manual: true }, runtime.abortSignal)
      return readAccountState()
    },

    async completeManualLogin(code: string): Promise<NeodbAccountState> {
      await runtime.oauthFlow.completeWithCode(code, runtime.abortSignal)
      return readAccountState()
    },

    async cancelPendingLogin(): Promise<NeodbAccountState> {
      await runtime.oauthFlow.cancelPending()
      return readAccountState()
    },

    async logout(): Promise<NeodbAccountState> {
      await runtime.sessionStore.clearAll()
      return readAccountState()
    },

    async verifyAccount(): Promise<NeodbAccountVerification> {
      const user = await runtime.client.getOwnUser({ signal: runtime.abortSignal })
      const userName = user.username?.trim() || 'unknown'
      return { userName, displayName: user.display_name?.trim() || userName }
    },

    async listNovelProfiles(): Promise<NeodbProfileOption[]> {
      const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'novel' })
      return profiles.map((profile) => ({ id: profile.id, name: profile.name }))
    },

    async startImport(request: NeodbImportRequest): Promise<{ runId: string }> {
      const options: ImportOptions = {
        updateExisting: request.updateExisting,
        createMissing: request.createMissing,
        ...(request.profileId ? { profileId: request.profileId } : {})
      }
      return runtime.tasks.startImport(options)
    },

    async startPushAll(): Promise<{ runId: string }> {
      return runtime.tasks.startPushAll()
    },

    async getTaskState(runId: string): Promise<NeodbTaskStateView | null> {
      return runtime.tasks.getTaskState(runId)
    },

    async cancelTask(runId: string): Promise<boolean> {
      return runtime.tasks.cancelTask(runId)
    },

    async createAutomation(kind: NeodbAutomationKind): Promise<void> {
      await createNeodbAutomation(kind)
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    }
  }
}

async function listRunningOperations(): Promise<readonly string[]> {
  const active = await kisaki.taskRuns.listActiveOwn({ limit: 20 }).catch(() => [])
  return active.map((run) => run.operation)
}

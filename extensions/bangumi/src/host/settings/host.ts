import { kisaki, type JsonObject } from '@kisaki3/extension-sdk'
import {
  normalizeFullSyncArgs,
  normalizeImportCollectionsArgs,
  normalizeImportIndexArgs
} from '../jobs/args'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from '../jobs/commands'
import { assertBangumiCommandIdle } from '../jobs/status'
import type {
  BangumiAutomationKind,
  BangumiSettingsFormState,
  BangumiSettingsHostFunctions,
  BangumiSettingsOverview
} from '../../shared/settings'
import { createBangumiAutomation } from './automations'
import { applyFormState, toFullSyncArgs, toImportCollectionsArgs, toImportIndexArgs } from './forms'
import { resolveSettingsOverview } from './overview'
import { runBangumiPreview } from './preview'
import type { BangumiSettingsRuntime } from './runtime'
import type { BangumiSettingsSession } from './session'

/**
 * RPC façade exposed to the settings webview. Form/state mapping, overview
 * resolution, previews, and automations live in their own modules.
 */
export function createBangumiSettingsHostFunctions(
  runtime: BangumiSettingsRuntime,
  session: BangumiSettingsSession
): BangumiSettingsHostFunctions {
  return {
    getOverview(): Promise<BangumiSettingsOverview> {
      return resolveSettingsOverview(runtime)
    },

    async saveSettings(form: BangumiSettingsFormState): Promise<void> {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(applyFormState(current, form))
    },

    async login(): Promise<void> {
      await runtime.oauthFlow.startLogin(runtime.abortSignal)
    },

    async verifyAccount(): Promise<{ nickname: string }> {
      const verification = await runtime.accountService.verifyAccount(runtime.abortSignal)
      return { nickname: verification.account.nickname }
    },

    async refreshCredentials(): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.authRefresh, {
        forceRefresh: true,
        verifyAccount: true
      })
    },

    async logout(): Promise<void> {
      await runtime.accountService.logout()
    },

    async runChangedSync(): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.syncChangedItems, {
        scope: 'game',
        limit: 500
      })
    },

    previewFullSync(args) {
      return runBangumiPreview(
        session,
        runtime.abortSignal,
        BANGUMI_COMMAND_IDS.syncFull,
        (handle) =>
          runtime.jobRunner.previewFullSync(normalizeFullSyncArgs(toFullSyncArgs(args)), {
            commandId: BANGUMI_COMMAND_IDS.syncFull,
            run: handle
          })
      )
    },

    async runFullSync(args): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.syncFull, toFullSyncArgs(args))
    },

    previewImportCollections(args) {
      return runBangumiPreview(
        session,
        runtime.abortSignal,
        BANGUMI_COMMAND_IDS.importCollections,
        (handle) =>
          runtime.jobRunner.previewImportCollections(
            normalizeImportCollectionsArgs(toImportCollectionsArgs(args)),
            { commandId: BANGUMI_COMMAND_IDS.importCollections, run: handle }
          )
      )
    },

    async runImportCollections(args): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.importCollections, toImportCollectionsArgs(args))
    },

    previewImportIndex(args) {
      return runBangumiPreview(
        session,
        runtime.abortSignal,
        BANGUMI_COMMAND_IDS.importIndex,
        (handle) =>
          runtime.jobRunner.previewImportIndex(normalizeImportIndexArgs(toImportIndexArgs(args)), {
            commandId: BANGUMI_COMMAND_IDS.importIndex,
            run: handle
          })
      )
    },

    async runImportIndex(args): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.importIndex, toImportIndexArgs(args))
    },

    async createAutomation(kind: BangumiAutomationKind): Promise<void> {
      await createBangumiAutomation(runtime.settingsStore, kind)
    },

    async clearSyncState(): Promise<void> {
      await Promise.all([runtime.syncStateStore.clear(), runtime.syncQueueStore.clear()])
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    }
  }
}

async function startCommandJob(commandId: BangumiCommandId, args: JsonObject): Promise<void> {
  await assertBangumiCommandIdle(commandId)
  await kisaki.commands.invoke({ commandId, args })
}

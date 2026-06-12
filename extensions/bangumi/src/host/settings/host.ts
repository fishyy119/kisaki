import {
  ExtensionTaskRunCancellation,
  kisaki,
  type ExtensionTaskRunProgressUpdate,
  type ExtensionTaskRunResult,
  type JsonObject
} from '@kisaki3/extension-sdk'
import type { AccountService } from '../auth/account'
import type { OAuthFlow } from '../auth/oauth-flow'
import type { TokenService } from '../auth/token-service'
import type { SettingsStore } from '../config/store'
import type { BangumiSettingsV1 } from '../config/schema'
import {
  normalizeFullSyncArgs,
  normalizeImportCollectionsArgs,
  normalizeImportIndexArgs
} from '../jobs/args'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from '../jobs/commands'
import type { BangumiJobHandle, JobRunner } from '../jobs/runner'
import type { MediaRegistry } from '../media/registry'
import { BangumiExtensionError } from '../utils/errors'
import { omitUndefined } from '../utils/object'
import type { SyncStateStore } from '../sync/fingerprint'
import type { SyncQueueStore } from '../sync/queue'
import type {
  BangumiAutomationKind,
  BangumiAutomationState,
  BangumiFullSyncFormArgs,
  BangumiImportCollectionsFormArgs,
  BangumiImportIndexFormArgs,
  BangumiPreviewGroupDto,
  BangumiSettingsFormState,
  BangumiSettingsHostFunctions,
  BangumiSettingsOverview
} from '../../shared/settings'

export interface BangumiSettingsRuntime {
  settingsStore: SettingsStore
  accountService: AccountService
  oauthFlow: OAuthFlow
  tokenService: TokenService
  jobRunner: JobRunner
  mediaRegistry: MediaRegistry
  syncStateStore: SyncStateStore
  syncQueueStore: SyncQueueStore
  abortSignal: AbortSignal
}

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

export function createBangumiSettingsHostFunctions(
  runtime: BangumiSettingsRuntime
): BangumiSettingsHostFunctions {
  return {
    async getOverview(): Promise<BangumiSettingsOverview> {
      const [settings, tokenState, account, activeJobs, profiles, collections, automations] =
        await Promise.all([
          runtime.settingsStore.get(),
          runtime.tokenService.getStoredTokenState(),
          runtime.accountService.getAccountSnapshot(),
          resolveActiveJobs(),
          listProfiles(runtime),
          listCollections(runtime),
          resolveAutomationStates()
        ])

      return {
        form: toFormState(settings),
        account: {
          loggedIn: Boolean(account && tokenState.hasToken),
          nickname: account?.nickname ?? null,
          username: account?.username ?? null,
          hasToken: tokenState.hasToken,
          hasRefreshToken: tokenState.hasRefreshToken,
          expiresAt: tokenState.expiresAt ?? null,
          expired: tokenState.expired
        },
        activeJobs,
        profiles,
        collections,
        automations
      }
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

    async previewFullSync(args) {
      return runPreview(BANGUMI_COMMAND_IDS.syncFull, 'Bangumi 全量同步预览', (run) =>
        runtime.jobRunner.previewFullSync(normalizeFullSyncArgs(toFullSyncArgs(args)), {
          commandId: BANGUMI_COMMAND_IDS.syncFull,
          run
        })
      )
    },

    async runFullSync(args): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.syncFull, toFullSyncArgs(args))
    },

    async previewImportCollections(args) {
      return runPreview(BANGUMI_COMMAND_IDS.importCollections, 'Bangumi 导入预览', (run) =>
        runtime.jobRunner.previewImportCollections(
          normalizeImportCollectionsArgs(toImportCollectionsArgs(args)),
          { commandId: BANGUMI_COMMAND_IDS.importCollections, run }
        )
      )
    },

    async runImportCollections(args): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.importCollections, toImportCollectionsArgs(args))
    },

    async previewImportIndex(args) {
      return runPreview(BANGUMI_COMMAND_IDS.importIndex, 'Bangumi 目录导入预览', (run) =>
        runtime.jobRunner.previewImportIndex(normalizeImportIndexArgs(toImportIndexArgs(args)), {
          commandId: BANGUMI_COMMAND_IDS.importIndex,
          run
        })
      )
    },

    async runImportIndex(args): Promise<void> {
      await startCommandJob(BANGUMI_COMMAND_IDS.importIndex, toImportIndexArgs(args))
    },

    async createAutomation(kind: BangumiAutomationKind): Promise<void> {
      await createBangumiAutomation(runtime, kind)
    },

    async clearSyncState(): Promise<void> {
      await Promise.all([runtime.syncStateStore.clear(), runtime.syncQueueStore.clear()])
    },

    async resetSettings(): Promise<void> {
      await runtime.settingsStore.reset()
    }
  }

  async function runPreview(
    commandId: BangumiCommandId,
    title: string,
    run: (handle: BangumiJobHandle) => Promise<{ previewGroups: readonly BangumiPreviewGroupDto[] }>
  ): Promise<readonly BangumiPreviewGroupDto[]> {
    await assertCommandIdle(commandId)
    const handle = await createNotificationPreviewHandle(title, runtime.abortSignal)
    const summary = await run(handle)
    return summary.previewGroups
  }
}

function toFormState(settings: BangumiSettingsV1): BangumiSettingsFormState {
  const autoSync = settings.game.autoSync

  return {
    autoSyncEnabled: autoSync.enabled,
    autoSyncItems: [
      ...(autoSync.syncOnCreate ? (['create'] as const) : []),
      ...(autoSync.playStatusEnabled ? (['status'] as const) : []),
      ...(autoSync.scoreEnabled ? (['score'] as const) : [])
    ],
    clearRemoteScoreWhenEmpty: autoSync.clearRemoteScoreWhenEmpty,
    loginTimeoutMinutes: Math.round(settings.auth.loginTimeoutMs / 60_000),
    rateLimitMaxRequests: settings.client.rateLimit.maxRequests,
    rateLimitWindowSeconds: Math.round(settings.client.rateLimit.windowMs / 1000),
    timeoutSeconds: Math.round(settings.client.timeoutMs / 1000),
    retryCount: settings.client.retryCount,
    debounceSeconds: settings.game.autoSync.debounceMs / 1000,
    notifyErrors: autoSync.notifyErrors
  }
}

function applyFormState(
  current: BangumiSettingsV1,
  form: BangumiSettingsFormState
): BangumiSettingsV1 {
  return {
    ...current,
    auth: {
      loginTimeoutMs: form.loginTimeoutMinutes * 60_000
    },
    game: {
      autoSync: {
        ...current.game.autoSync,
        enabled: form.autoSyncEnabled,
        syncOnCreate: form.autoSyncItems.includes('create'),
        playStatusEnabled: form.autoSyncItems.includes('status'),
        scoreEnabled: form.autoSyncItems.includes('score'),
        clearRemoteScoreWhenEmpty: form.clearRemoteScoreWhenEmpty,
        debounceMs: Math.round(form.debounceSeconds * 1000),
        notifyErrors: form.notifyErrors
      }
    },
    client: {
      rateLimit: {
        maxRequests: form.rateLimitMaxRequests,
        windowMs: form.rateLimitWindowSeconds * 1000
      },
      timeoutMs: form.timeoutSeconds * 1000,
      retryCount: form.retryCount
    }
  }
}

function toFullSyncArgs(args: BangumiFullSyncFormArgs): JsonObject {
  return {
    scope: 'game',
    updateExisting: args.updateExisting,
    playStatusEnabled: args.items.includes('status'),
    scoreEnabled: args.items.includes('score'),
    clearRemoteScoreWhenEmpty: args.clearRemoteScoreWhenEmpty,
    batchSize: args.batchSize
  }
}

function toImportCollectionsArgs(args: BangumiImportCollectionsFormArgs): JsonObject {
  return {
    scope: 'game',
    profileId: args.profileId,
    collectionTypes: [...args.collectionTypes],
    fields: {
      status: args.dataItems.includes('status'),
      score: args.dataItems.includes('score'),
      tags: args.dataItems.includes('tags')
    },
    patchExisting: args.patchExisting,
    targetCollection: args.targetCollectionId
      ? { kind: 'existing', collectionId: args.targetCollectionId }
      : { kind: 'none' }
  }
}

function toImportIndexArgs(args: BangumiImportIndexFormArgs): JsonObject {
  return {
    scope: 'game',
    profileId: args.profileId,
    indexInput: args.indexInput,
    patchExisting: args.patchExisting,
    targetCollection:
      args.targetCollectionMode === 'existing'
        ? { kind: 'existing', collectionId: args.targetCollectionId ?? '' }
        : { kind: args.targetCollectionMode }
  }
}

async function startCommandJob(commandId: BangumiCommandId, args: JsonObject): Promise<void> {
  await assertCommandIdle(commandId)
  await kisaki.commands.invoke({ commandId, args })
}

async function assertCommandIdle(commandId: BangumiCommandId): Promise<void> {
  if (await isBangumiCommandActive(commandId)) {
    throw new BangumiExtensionError(
      'bangumi_job_running',
      '该 Bangumi 任务正在运行，请先等待完成或取消。'
    )
  }
}

async function isBangumiCommandActive(commandId: BangumiCommandId): Promise<boolean> {
  const runs = await kisaki.taskRuns.listActiveOwn({
    subject: { type: 'command', id: commandId },
    limit: 1
  })
  return runs.length > 0
}

async function resolveActiveJobs() {
  const [accountRefresh, syncChangedItems, syncFull, importCollections, importIndex] =
    await Promise.all([
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.authRefresh),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.syncChangedItems),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.syncFull),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.importCollections),
      isBangumiCommandActive(BANGUMI_COMMAND_IDS.importIndex)
    ])

  return { accountRefresh, syncChangedItems, syncFull, importCollections, importIndex }
}

const AUTOMATION_COMMAND_BY_KIND: Record<BangumiAutomationKind, BangumiCommandId> = {
  'auth-refresh': BANGUMI_COMMAND_IDS.authRefresh,
  'sync-changed': BANGUMI_COMMAND_IDS.syncChangedItems,
  'sync-full-daily': BANGUMI_COMMAND_IDS.syncFull
}

async function resolveAutomationStates(): Promise<readonly BangumiAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as BangumiAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

async function createBangumiAutomation(
  runtime: BangumiSettingsRuntime,
  kind: BangumiAutomationKind
): Promise<void> {
  if (kind === 'auth-refresh') {
    await kisaki.automations.create({
      name: 'Bangumi 启动时刷新凭据',
      commandId: BANGUMI_COMMAND_IDS.authRefresh,
      args: { forceRefresh: true, verifyAccount: true },
      enabled: true,
      triggers: { onStartup: true },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  if (kind === 'sync-changed') {
    await kisaki.automations.create({
      name: 'Bangumi 启动后同步变更队列',
      commandId: BANGUMI_COMMAND_IDS.syncChangedItems,
      args: { scope: 'game', limit: 500 },
      enabled: true,
      triggers: { onStartup: true },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  const settings = await runtime.settingsStore.get()
  await kisaki.automations.create({
    name: 'Bangumi 每日全量同步',
    commandId: BANGUMI_COMMAND_IDS.syncFull,
    args: {
      scope: 'game',
      updateExisting: true,
      playStatusEnabled: settings.game.autoSync.playStatusEnabled,
      scoreEnabled: settings.game.autoSync.scoreEnabled,
      clearRemoteScoreWhenEmpty: settings.game.autoSync.clearRemoteScoreWhenEmpty,
      batchSize: 100
    },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 4 * * *' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}

async function listProfiles(runtime: BangumiSettingsRuntime) {
  try {
    const profiles = (await runtime.mediaRegistry.getLocalAdapter('game')?.listProfiles?.()) ?? []
    return profiles.map((profile) => ({ value: profile.id, label: profile.name }))
  } catch {
    return []
  }
}

async function listCollections(runtime: BangumiSettingsRuntime) {
  try {
    const collections =
      (await runtime.mediaRegistry.getLocalAdapter('game')?.listCollections?.()) ?? []
    return collections.map((collection) => ({ value: collection.id, label: collection.name }))
  } catch {
    return []
  }
}

type PreviewResult = Omit<ExtensionTaskRunResult, 'status' | 'error'>

async function createNotificationPreviewHandle(
  title: string,
  signal: AbortSignal
): Promise<BangumiJobHandle> {
  const id = `bangumi.preview.${Date.now()}.${Math.random().toString(36).slice(2)}`
  const handle = await kisaki.notify.loading(title, {
    id,
    message: '正在准备预览...',
    closable: true
  })

  return new NotificationPreviewHandle(handle.id, title, signal)
}

class NotificationPreviewHandle implements BangumiJobHandle {
  constructor(
    private readonly id: string,
    private readonly title: string,
    readonly signal: AbortSignal
  ) {}

  async report(update: ExtensionTaskRunProgressUpdate): Promise<void> {
    await kisaki.notify.update(
      this.id,
      'loading',
      this.title,
      omitUndefined({
        message: formatPreviewProgress(update),
        closable: true
      })
    )
  }

  async checkpoint(): Promise<void> {
    if (this.signal.aborted) {
      throw new ExtensionTaskRunCancellation('Bangumi preview was cancelled.')
    }
  }

  async complete(result?: PreviewResult): Promise<void> {
    await kisaki.notify.update(this.id, 'success', this.title, {
      message: result?.summary ?? '预览已完成。',
      closable: true
    })
  }

  async fail(_error: unknown, result?: PreviewResult): Promise<void> {
    await kisaki.notify.update(this.id, 'error', this.title, {
      message: result?.summary ?? '预览失败。',
      closable: true
    })
  }

  async cancel(result?: PreviewResult): Promise<void> {
    await kisaki.notify.update(this.id, 'warning', this.title, {
      message: result?.summary ?? '预览已取消。',
      closable: true
    })
  }
}

function formatPreviewProgress(update: ExtensionTaskRunProgressUpdate): string | undefined {
  const base = update.phase?.label
  const current = update.work?.current
  const total = update.work?.total
  const count =
    current !== undefined && total !== undefined
      ? `(${current}/${total})`
      : current !== undefined
        ? `(${current})`
        : undefined
  return count ? [base, count].filter(Boolean).join(' ') : base
}

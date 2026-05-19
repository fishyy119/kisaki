import {
  kisaki,
  type CommandContributionExecuteEvent,
  type ExtensionLogger,
  type LibraryGame
} from '@kisaki/extension-sdk'
import type { BangumiClient } from '../api/client'
import { BangumiApiError } from '../api/errors'
import { collectPages } from '../api/pagination'
import type { BangumiIndexSubject, BangumiUserCollection } from '../api/types'
import type { AccountService } from '../auth/account'
import type { TokenService } from '../auth/token-service'
import type {
  BangumiCollectionType,
  BangumiSettingsV1,
  BangumiStatusMappingValue
} from '../config/schema'
import type { SettingsStore } from '../config/store'
import { BANGUMI_SOURCE_ID, BANGUMI_SUBJECT_TYPE_GAME } from '../shared/constants'
import { BangumiExtensionError } from '../shared/errors'
import type {
  BangumiAuthRefreshArgs,
  BangumiChangedGamesSyncArgs,
  BangumiFullSyncArgs,
  BangumiImportIndexArgs,
  BangumiImportMyCollectionsArgs
} from './args'
import {
  createBangumiJobSummary,
  createJobError,
  isCancellationError,
  type BangumiJobError,
  type BangumiJobPreviewChange,
  type BangumiJobSummary
} from './summary'

export interface JobRunnerDependencies {
  settingsStore: SettingsStore
  client: BangumiClient
  tokenService: TokenService
  accountService: AccountService
  logger?: ExtensionLogger
}

interface JobCounters {
  [key: string]: number
}

interface JobState {
  commandId: string
  startedAt: number
  dryRun: boolean
  counters: JobCounters
  changes: BangumiJobPreviewChange[]
  errors: BangumiJobError[]
  event: CommandContributionExecuteEvent
}

export class JobRunner {
  constructor(private readonly deps: JobRunnerDependencies) {}

  async runAuthRefresh(
    args: BangumiAuthRefreshArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      job.report('refreshingToken', '正在刷新 Bangumi 凭据...', { indeterminate: true })

      if (args.forceRefresh) {
        await this.deps.tokenService.refreshAccessToken({
          forceRefresh: true,
          signal: event.signal
        })
        job.increment('refreshed')
      } else {
        await this.deps.tokenService.getAccessToken({ signal: event.signal })
        job.increment('checkedToken')
      }

      if (args.verifyAccount) {
        job.report('verifyingAccount', '正在验证 Bangumi 账号...', { indeterminate: true })
        const verification = await this.deps.accountService.verifyAccount(event.signal)
        job.increment('verified')
        job.report('completed', `Bangumi 账号有效：${verification.account.nickname}`, {
          current: 1,
          total: 1
        })
      } else {
        const account = await this.deps.accountService.refreshAccount(event.signal)
        job.increment('accountRefreshed')
        job.report('completed', `Bangumi 账号摘要已更新：${account.nickname}`, {
          current: 1,
          total: 1
        })
      }
    })
  }

  async runChangedGamesSync(
    args: BangumiChangedGamesSyncArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      await this.deps.settingsStore.get()
      job.report('loadingQueue', '正在读取 Bangumi 变更同步队列...', { indeterminate: true })
      assertNotCancelled(event.signal)

      job.increment('queued', 0)
      job.increment('skippedPendingSyncEngine', 0)
      job.report('completed', '变更队列同步命令已完成参数检查，尚未执行远端写入。', {
        current: 0,
        total: 0
      })
    })
  }

  async runFullSync(
    args: BangumiFullSyncArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      const settings = await this.deps.settingsStore.get()
      const account = await this.requireAccount()
      const playStatusEnabled = args.playStatusEnabled ?? settings.autoSync.playStatusEnabled
      const scoreEnabled = args.scoreEnabled ?? settings.autoSync.scoreEnabled
      let offset = 0
      let processed = 0

      job.increment('selectedSyncFields', Number(playStatusEnabled) + Number(scoreEnabled))

      while (true) {
        assertNotCancelled(event.signal)
        job.report('loadingGames', '正在扫描本地游戏...', {
          current: processed,
          indeterminate: true
        })

        const games = await kisaki.library.games.list({
          includeNsfw: true,
          limit: args.batchSize,
          offset
        })

        if (games.length === 0) {
          break
        }

        for (const game of games) {
          assertNotCancelled(event.signal)
          processed += 1
          job.increment('processed')

          const subjectId = readBangumiSubjectId(game)
          if (!subjectId) {
            job.increment('skippedNoBangumiId')
            continue
          }

          job.increment('withBangumiId')
          if (!playStatusEnabled && !scoreEnabled) {
            job.increment('skippedByMapping')
            continue
          }

          const remote = await this.getRemoteCollection(
            account.username,
            Number(subjectId),
            event.signal
          )
          const change = createFullSyncPreviewChange({
            game,
            subjectId,
            remote,
            settings,
            playStatusEnabled,
            scoreEnabled,
            updateExisting: args.updateExisting,
            clearRemoteScoreWhenEmpty: args.clearRemoteScoreWhenEmpty === true
          })

          if (!change) {
            job.increment('skippedNoChange')
            continue
          }

          if (args.dryRun) {
            job.addChange(change)
            job.increment('wouldSync')
          } else {
            job.increment('skippedPendingSyncEngine')
          }
        }

        offset += games.length
        if (games.length < args.batchSize) {
          break
        }
      }

      const message = args.dryRun
        ? `全量同步预览完成：${job.counters.wouldSync ?? 0} 个游戏可同步。`
        : '全量同步命令已完成扫描，尚未执行远端写入。'
      job.report('completed', message, {
        current: processed,
        total: processed
      })
    })
  }

  async runImportMyCollections(
    args: BangumiImportMyCollectionsArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      job.report('validating', '正在检查 Bangumi 导入参数...', { indeterminate: true })
      await this.requireGameProfile(args.profileId)
      const account = await this.requireAccount()

      job.increment('selectedCollectionTypes', args.collectionTypes.length)
      job.increment('selectedWriteFields', countEnabledFields(args.fields))
      const localSubjectIds = await listLocalBangumiSubjectIds(event.signal)
      const collections = await this.collectUserCollections(
        account.username,
        args.collectionTypes,
        event,
        job
      )

      for (const collection of collections) {
        assertNotCancelled(event.signal)
        const subjectId = readCollectionSubjectId(collection)
        if (!subjectId) {
          continue
        }

        job.increment('processed')
        if (localSubjectIds.has(String(subjectId))) {
          job.increment('skippedExistingLocalGame')
          continue
        }

        if (args.dryRun) {
          job.addChange(createImportCollectionPreviewChange(collection, args.fields))
          job.increment('wouldImport')
        } else {
          job.increment('skippedPendingImporter')
        }
      }

      const message = args.dryRun
        ? `我的收藏导入预览完成：${job.counters.wouldImport ?? 0} 个游戏将导入。`
        : '我的收藏导入命令已完成扫描，尚未执行本地写入。'
      job.report('completed', message, {
        current: job.counters.processed ?? 0,
        total: job.counters.processed ?? 0
      })
    })
  }

  async runImportIndex(
    args: BangumiImportIndexArgs,
    event: CommandContributionExecuteEvent
  ): Promise<BangumiJobSummary> {
    return this.runJob(event, args.dryRun, async (job) => {
      job.report('validating', '正在检查 Bangumi 目录导入参数...', { indeterminate: true })
      await this.requireGameProfile(args.profileId)

      job.increment('indices')
      const [index, localSubjectIds] = await Promise.all([
        this.deps.client.getIndex(args.indexId, { signal: event.signal }),
        listLocalBangumiSubjectIds(event.signal)
      ])
      const subjects = await this.collectIndexSubjects(args.indexId, event, job)

      for (const subject of subjects) {
        assertNotCancelled(event.signal)
        const subjectId = normalizePositiveInteger(subject.id)
        if (!subjectId) {
          continue
        }

        job.increment('processed')
        if (localSubjectIds.has(String(subjectId))) {
          job.increment('skippedExistingLocalGame')
          continue
        }

        if (args.dryRun) {
          job.addChange(createIndexPreviewChange(subject, index.title))
          job.increment('wouldImport')
        } else {
          job.increment('skippedPendingImporter')
        }
      }

      const message = args.dryRun
        ? `目录导入预览完成：${job.counters.wouldImport ?? 0} 个游戏将导入。`
        : '目录导入命令已完成扫描，尚未执行本地写入。'
      job.report('completed', message, {
        current: job.counters.processed ?? 0,
        total: job.counters.processed ?? 0
      })
    })
  }

  private async runJob(
    event: CommandContributionExecuteEvent,
    dryRun: boolean,
    execute: (job: JobStateController) => Promise<void>
  ): Promise<BangumiJobSummary> {
    const state: JobState = {
      commandId: event.commandId,
      startedAt: Date.now(),
      dryRun,
      counters: {},
      changes: [],
      errors: [],
      event
    }
    const job = new JobStateController(state)

    try {
      assertNotCancelled(event.signal)
      await execute(job)
      assertNotCancelled(event.signal)
      const summary = createBangumiJobSummary({
        commandId: state.commandId,
        startedAt: state.startedAt,
        status: 'completed',
        dryRun: state.dryRun,
        counters: state.counters,
        changes: state.changes,
        errors: state.errors
      })
      return summary
    } catch (error) {
      if (isCancellationError(error) || event.signal.aborted) {
        job.report('cancelled', 'Bangumi job 已取消。', { indeterminate: true })
        throw new BangumiExtensionError('job_cancelled', 'Bangumi job 已取消。')
      }

      state.errors.push(createJobError(error))
      const message = toUserErrorMessage(error)
      job.report('failed', message, { indeterminate: true })
      this.deps.logger?.warn('Bangumi job failed.', toSafeErrorLog(error))
      throw error
    }
  }

  private async requireGameProfile(profileId: string): Promise<void> {
    const profile = await kisaki.scrapers.profiles.get(profileId)
    if (!profile || profile.mediaType !== 'game') {
      throw new BangumiExtensionError('profile_missing', '选择的游戏 scraper profile 不存在。')
    }
  }

  private async requireAccount() {
    const account = await this.deps.accountService.getAccountSnapshot()
    if (!account) {
      throw new BangumiExtensionError('auth_required', '请先登录 Bangumi 账号。')
    }
    return account
  }

  private async getRemoteCollection(
    username: string,
    subjectId: number,
    signal: AbortSignal
  ): Promise<BangumiUserCollection | undefined> {
    try {
      return await this.deps.client.getUserCollection(username, subjectId, { signal })
    } catch (error) {
      if (error instanceof BangumiApiError && error.status === 404) {
        return undefined
      }
      throw error
    }
  }

  private async collectUserCollections(
    username: string,
    collectionTypes: readonly BangumiCollectionType[],
    event: CommandContributionExecuteEvent,
    job: JobStateController
  ): Promise<readonly BangumiUserCollection[]> {
    const collections: BangumiUserCollection[] = []
    for (const collectionType of collectionTypes) {
      assertNotCancelled(event.signal)
      job.report(
        'loadingCollections',
        `正在读取 Bangumi ${formatCollectionType(collectionType)}收藏...`,
        {
          indeterminate: true
        }
      )

      collections.push(
        ...(await collectPages(
          (query) =>
            this.deps.client.getUserCollections(
              username,
              {
                ...query,
                subject_type: BANGUMI_SUBJECT_TYPE_GAME,
                type: collectionType
              },
              { signal: event.signal }
            ),
          { limit: 50 }
        ))
      )
    }

    return collections
  }

  private async collectIndexSubjects(
    indexId: number,
    event: CommandContributionExecuteEvent,
    job: JobStateController
  ): Promise<readonly BangumiIndexSubject[]> {
    job.report('loadingIndexSubjects', '正在读取 Bangumi 目录条目...', {
      indeterminate: true
    })

    return collectPages(
      (query) =>
        this.deps.client.getIndexSubjects(
          indexId,
          {
            ...query,
            type: BANGUMI_SUBJECT_TYPE_GAME
          },
          { signal: event.signal }
        ),
      { limit: 50 }
    )
  }
}

class JobStateController {
  constructor(private readonly state: JobState) {}

  get counters(): JobCounters {
    return this.state.counters
  }

  get changes(): readonly BangumiJobPreviewChange[] {
    return this.state.changes
  }

  increment(key: string, amount = 1): void {
    this.state.counters[key] = (this.state.counters[key] ?? 0) + amount
  }

  addChange(change: BangumiJobPreviewChange): void {
    this.state.changes.push(change)
  }

  report(
    phase: string,
    message: string,
    progress: { current?: number; total?: number; indeterminate?: boolean } = {}
  ): void {
    const update = {
      phase,
      message,
      ...progress
    }
    this.state.event.reportProgress(update)
  }
}

async function listLocalBangumiSubjectIds(signal: AbortSignal): Promise<Set<string>> {
  const subjectIds = new Set<string>()
  let offset = 0
  const limit = 500

  while (true) {
    assertNotCancelled(signal)
    const games = await kisaki.library.games.list({
      includeNsfw: true,
      limit,
      offset
    })

    for (const game of games) {
      const subjectId = readBangumiSubjectId(game)
      if (subjectId) {
        subjectIds.add(subjectId)
      }
    }

    offset += games.length
    if (games.length < limit) {
      return subjectIds
    }
  }
}

function createFullSyncPreviewChange({
  game,
  subjectId,
  remote,
  settings,
  playStatusEnabled,
  scoreEnabled,
  updateExisting,
  clearRemoteScoreWhenEmpty
}: {
  game: LibraryGame
  subjectId: string
  remote?: BangumiUserCollection
  settings: BangumiSettingsV1
  playStatusEnabled: boolean
  scoreEnabled: boolean
  updateExisting: boolean
  clearRemoteScoreWhenEmpty: boolean
}): BangumiJobPreviewChange | undefined {
  if (remote && !updateExisting) {
    return undefined
  }

  const localValues: string[] = []
  const remoteValues: string[] = []
  const targetCollectionType = settings.autoSync.statusToBangumi[game.status]

  if (playStatusEnabled && targetCollectionType !== 'skip') {
    if (!remote || remote.type !== targetCollectionType) {
      localValues.push(formatStatusMappingValue(targetCollectionType))
      remoteValues.push(remote ? formatCollectionType(remote.type) : '未收藏')
    }
  }

  if (scoreEnabled) {
    const localScore = normalizeGameScore(game.score)
    const remoteScore = normalizeGameScore(remote?.rate)
    if (localScore !== undefined && localScore !== remoteScore) {
      localValues.push(`${localScore}`)
      remoteValues.push(remoteScore === undefined ? '未评分' : `${remoteScore}`)
    } else if (
      localScore === undefined &&
      remoteScore !== undefined &&
      clearRemoteScoreWhenEmpty &&
      remote
    ) {
      localValues.push('未评分')
      remoteValues.push(`${remoteScore}`)
    }
  }

  if (localValues.length === 0) {
    return undefined
  }

  return {
    game: game.name,
    bangumi: createSubjectLink(subjectId),
    action: remote ? '更新收藏' : '创建收藏',
    local: localValues.join('；'),
    remote: remoteValues.join('；')
  }
}

function createImportCollectionPreviewChange(
  collection: BangumiUserCollection,
  fields: BangumiImportMyCollectionsArgs['fields']
): BangumiJobPreviewChange {
  const subjectId = readCollectionSubjectId(collection)
  const subject = collection.subject
  const title = subject
    ? formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
    : `${subjectId}`

  return {
    game: title,
    bangumi: createSubjectLink(subjectId),
    action: '创建游戏',
    local: '不存在',
    remote: formatImportCollectionRemoteValue(collection, fields)
  }
}

function createIndexPreviewChange(
  subject: BangumiIndexSubject,
  indexTitle: string
): BangumiJobPreviewChange {
  const subjectId = normalizePositiveInteger(subject.id) ?? subject.id
  const title = formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)

  return {
    game: title,
    bangumi: createSubjectLink(subjectId),
    action: '创建游戏',
    local: '不存在',
    remote: indexTitle
  }
}

function readBangumiSubjectId(game: LibraryGame): string | undefined {
  const externalId = game.externalIds.find((item) => item.source === BANGUMI_SOURCE_ID)
  const id = externalId?.id.trim()
  return id && /^\d+$/.test(id) ? id : undefined
}

function countEnabledFields(fields: { status: boolean; score: boolean; tags: boolean }): number {
  return Number(fields.status) + Number(fields.score) + Number(fields.tags)
}

function readCollectionSubjectId(collection: BangumiUserCollection): number {
  return (
    normalizePositiveInteger(collection.subject_id) ??
    normalizePositiveInteger(collection.subject?.id) ??
    0
  )
}

function normalizePositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}

function normalizeGameScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.max(1, Math.trunc(value)))
    : undefined
}

function formatBangumiSubjectTitle(
  nameCn: string | undefined,
  name: string | undefined,
  fallback: string | number
): string {
  return nameCn?.trim() || name?.trim() || `Bangumi ${fallback}`
}

function createSubjectLink(subjectId: string | number): { label: string; href: string } {
  return {
    label: String(subjectId),
    href: `https://bgm.tv/subject/${subjectId}`
  }
}

function formatStatusMappingValue(value: BangumiStatusMappingValue): string {
  return value === 'skip' ? '跳过' : formatCollectionType(value)
}

function formatCollectionType(value: BangumiCollectionType): string {
  switch (value) {
    case 1:
      return '想玩'
    case 2:
      return '玩过'
    case 3:
      return '在玩'
    case 4:
      return '搁置'
    case 5:
      return '抛弃'
  }
}

function formatImportCollectionRemoteValue(
  collection: BangumiUserCollection,
  fields: BangumiImportMyCollectionsArgs['fields']
): string {
  const values: string[] = []

  if (fields.status) {
    values.push(formatCollectionType(collection.type))
  }

  if (fields.score) {
    values.push(formatCollectionScore(collection.rate))
  }

  if (fields.tags) {
    values.push(formatCollectionTags(collection.tags))
  }

  return values.length > 0 ? values.join('；') : formatCollectionType(collection.type)
}

function formatCollectionScore(score: number | undefined): string {
  return normalizeGameScore(score) === undefined ? '未评分' : `${normalizeGameScore(score)}`
}

function formatCollectionTags(tags: readonly string[] | undefined): string {
  const normalized = (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  return normalized.length > 0 ? normalized.join('、') : '无'
}

function assertNotCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new BangumiExtensionError('job_cancelled', 'Bangumi job 已取消。')
  }
}

function toUserErrorMessage(error: unknown): string {
  if (error instanceof BangumiExtensionError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim()
  }

  return 'Bangumi job 执行失败。'
}

function toSafeErrorLog(error: unknown): Record<string, unknown> {
  if (error instanceof BangumiExtensionError) {
    return { code: error.code, message: error.message }
  }

  if (error instanceof Error) {
    return { name: error.name, message: error.message }
  }

  return { message: String(error) }
}

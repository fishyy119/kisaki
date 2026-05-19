import {
  kisaki,
  type CommandContributionExecuteEvent,
  type ExtensionLogger,
  type LibraryCollection,
  type LibraryGame,
  type LibraryGamePatch,
  type LibraryGameStatus,
  type LibraryTag
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
  BangumiImportMyCollectionsArgs,
  BangumiImportTargetCollection
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

interface MyCollectionLocalUpdatePlan {
  patch: LibraryGamePatch
  tagNames: readonly string[]
  targetCollection?: ResolvedImportTargetCollection
  localValues: readonly string[]
  remoteValues: readonly string[]
}

interface ResolvedImportTargetCollection {
  id?: string
  name: string
  willCreate?: boolean
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
      const targetCollection = await resolveTargetCollection(args.targetCollection)

      job.increment('selectedCollectionTypes', args.collectionTypes.length)
      job.increment('selectedWriteFields', countEnabledFields(args.fields))
      job.increment('patchExisting', args.patchExisting ? 1 : 0)
      job.increment('selectedTargetCollections', targetCollection ? 1 : 0)
      const localGames = await listLocalBangumiGamesBySubjectId(event.signal)
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

        const subjectIdText = String(subjectId)
        job.increment('processed')

        try {
          const localGame = localGames.get(subjectIdText)
          if (localGame) {
            if (!args.patchExisting) {
              job.increment('skippedExistingLocalGame')
              continue
            }

            const change = await createImportCollectionPatchPreviewChange({
              game: localGame,
              collection,
              fields: args.fields,
              targetCollection
            })

            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            if (args.dryRun) {
              job.addChange(change)
              job.increment('wouldPatch')
            } else {
              await applyMyCollectionLocalUpdate({
                game: localGame,
                collection,
                fields: args.fields,
                targetCollection
              })
              job.increment('patchedExisting')
            }
            continue
          }

          if (args.dryRun) {
            job.addChange(
              createImportCollectionCreatePreviewChange(collection, args.fields, targetCollection)
            )
            job.increment('wouldImport')
            continue
          }

          const imported = await importGameFromCollection(args.profileId, collection)
          const game = await requireLibraryGame(imported.gameId)

          if (imported.isNew) {
            await applyMyCollectionLocalUpdate({
              game,
              collection,
              fields: args.fields,
              targetCollection
            })
            localGames.set(subjectIdText, game)
            job.increment('imported')
          } else if (args.patchExisting) {
            const change = await createImportCollectionPatchPreviewChange({
              game,
              collection,
              fields: args.fields,
              targetCollection
            })
            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            await applyMyCollectionLocalUpdate({
              game,
              collection,
              fields: args.fields,
              targetCollection
            })
            localGames.set(subjectIdText, game)
            job.increment('patchedExisting')
          } else {
            job.increment('skippedExistingLocalGame')
          }
        } catch (error) {
          if (isCancellationError(error) || event.signal.aborted) {
            throw error
          }
          job.addError(error, { subjectId: subjectIdText })
          job.increment('failedItems')
        }
      }

      const message = args.dryRun
        ? `我的收藏导入预览完成：${job.counters.wouldImport ?? 0} 个游戏将导入，${job.counters.wouldPatch ?? 0} 个已有游戏将更新。`
        : `我的收藏导入完成：新增 ${job.counters.imported ?? 0} 个游戏，更新 ${job.counters.patchedExisting ?? 0} 个已有游戏。`
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
      job.increment('patchExisting', args.patchExisting ? 1 : 0)
      const [index, localGames] = await Promise.all([
        this.deps.client.getIndex(args.indexId, { signal: event.signal }),
        listLocalBangumiGamesBySubjectId(event.signal)
      ])
      const targetCollection = await resolveIndexTargetCollection(
        args.targetCollection,
        index.title
      )
      job.increment('selectedTargetCollections', targetCollection ? 1 : 0)
      const subjects = await this.collectIndexSubjects(args.indexId, event, job)

      for (const subject of subjects) {
        assertNotCancelled(event.signal)
        const subjectId = normalizePositiveInteger(subject.id)
        if (!subjectId) {
          continue
        }

        const subjectIdText = String(subjectId)
        job.increment('processed')

        try {
          const localGame = localGames.get(subjectIdText)
          if (localGame) {
            if (!args.patchExisting || !targetCollection) {
              job.increment('skippedExistingLocalGame')
              continue
            }

            const change = await createIndexCollectionPatchPreviewChange(
              localGame,
              subjectId,
              targetCollection
            )
            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            if (args.dryRun) {
              job.addChange(change)
              job.increment('wouldPatch')
            } else {
              await ensureGameInTargetCollection(localGame.id, targetCollection)
              job.increment('patchedExisting')
            }
            continue
          }

          if (args.dryRun) {
            job.addChange(createIndexCreatePreviewChange(subject, index.title, targetCollection))
            job.increment('wouldImport')
            continue
          }

          const imported = await importGameFromIndexSubject(args.profileId, subject)
          const game = await requireLibraryGame(imported.gameId)
          if (targetCollection && imported.isNew) {
            await ensureGameInTargetCollection(game.id, targetCollection)
          }

          if (imported.isNew) {
            localGames.set(subjectIdText, game)
            job.increment('imported')
          } else if (args.patchExisting && targetCollection) {
            const change = await createIndexCollectionPatchPreviewChange(
              game,
              subjectId,
              targetCollection
            )
            if (!change) {
              job.increment('skippedNoChange')
              continue
            }

            await ensureGameInTargetCollection(game.id, targetCollection)
            localGames.set(subjectIdText, game)
            job.increment('patchedExisting')
          } else {
            job.increment('skippedExistingLocalGame')
          }
        } catch (error) {
          if (isCancellationError(error) || event.signal.aborted) {
            throw error
          }
          job.addError(error, { subjectId: subjectIdText })
          job.increment('failedItems')
        }
      }

      const message = args.dryRun
        ? `目录导入预览完成：${job.counters.wouldImport ?? 0} 个游戏将导入，${job.counters.wouldPatch ?? 0} 个已有游戏将更新。`
        : `目录导入完成：新增 ${job.counters.imported ?? 0} 个游戏，更新 ${job.counters.patchedExisting ?? 0} 个已有游戏。`
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

  addError(error: unknown, context: Partial<BangumiJobError> = {}): void {
    this.state.errors.push(createJobError(error, context))
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

async function listLocalBangumiGamesBySubjectId(
  signal: AbortSignal
): Promise<Map<string, LibraryGame>> {
  const gamesBySubjectId = new Map<string, LibraryGame>()
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
      if (subjectId && !gamesBySubjectId.has(subjectId)) {
        gamesBySubjectId.set(subjectId, game)
      }
    }

    offset += games.length
    if (games.length < limit) {
      return gamesBySubjectId
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
    const localScore = normalizeLocalScoreAsBangumiRate(game.score)
    const remoteScore = normalizeBangumiRate(remote?.rate)
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

function createImportCollectionCreatePreviewChange(
  collection: BangumiUserCollection,
  fields: BangumiImportMyCollectionsArgs['fields'],
  targetCollection: ResolvedImportTargetCollection | undefined
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
    remote: formatImportCollectionRemoteValue(collection, fields, targetCollection)
  }
}

async function createImportCollectionPatchPreviewChange({
  game,
  collection,
  fields,
  targetCollection
}: {
  game: LibraryGame
  collection: BangumiUserCollection
  fields: BangumiImportMyCollectionsArgs['fields']
  targetCollection: ResolvedImportTargetCollection | undefined
}): Promise<BangumiJobPreviewChange | undefined> {
  const subjectId = readCollectionSubjectId(collection)
  const plan = await buildMyCollectionLocalUpdatePlan({
    game,
    collection,
    fields,
    targetCollection
  })

  if (!hasMyCollectionLocalChanges(plan)) {
    return undefined
  }

  return {
    game: game.name,
    bangumi: createSubjectLink(subjectId),
    action: '更新游戏',
    local: plan.localValues.join('；'),
    remote: plan.remoteValues.join('；')
  }
}

function createIndexCreatePreviewChange(
  subject: BangumiIndexSubject,
  indexTitle: string,
  targetCollection: ResolvedImportTargetCollection | undefined
): BangumiJobPreviewChange {
  const subjectId = normalizePositiveInteger(subject.id) ?? subject.id
  const title = formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)

  return {
    game: title,
    bangumi: createSubjectLink(subjectId),
    action: '创建游戏',
    local: '不存在',
    remote: targetCollection ? formatTargetCollectionAction(targetCollection) : indexTitle
  }
}

async function createIndexCollectionPatchPreviewChange(
  game: LibraryGame,
  subjectId: number,
  targetCollection: ResolvedImportTargetCollection
): Promise<BangumiJobPreviewChange | undefined> {
  const hasRelation = targetCollection.id
    ? await hasGameCollectionRelation(game.id, targetCollection.id)
    : false
  if (hasRelation) {
    return undefined
  }

  return {
    game: game.name,
    bangumi: createSubjectLink(subjectId),
    action: '加入合集',
    local: '未加入合集',
    remote: formatTargetCollectionAction(targetCollection)
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

async function resolveTargetCollection(
  targetCollection: BangumiImportTargetCollection
): Promise<ResolvedImportTargetCollection | undefined> {
  if (targetCollection.kind !== 'existing') {
    return undefined
  }

  const collection = await kisaki.library.collections.get(targetCollection.collectionId)
  if (!collection || collection.isDynamic) {
    throw new BangumiExtensionError('bangumi_validation', '选择的目标本地合集不存在。')
  }

  return { id: collection.id, name: collection.name }
}

async function resolveIndexTargetCollection(
  targetCollection: BangumiImportTargetCollection,
  indexTitle: string
): Promise<ResolvedImportTargetCollection | undefined> {
  if (targetCollection.kind !== 'byIndexTitle') {
    return resolveTargetCollection(targetCollection)
  }

  const name = normalizeCollectionName(indexTitle)
  const existing = await findStaticCollectionByName(name)
  if (existing) {
    return { id: existing.id, name: existing.name }
  }

  return { name, willCreate: true }
}

async function findStaticCollectionByName(name: string): Promise<LibraryCollection | undefined> {
  const collections = await kisaki.library.collections.list({
    search: name,
    includeDynamic: false,
    includeStatic: true
  })
  return collections.find((collection) => collection.name === name && !collection.isDynamic)
}

async function createStaticCollectionByName(name: string): Promise<LibraryCollection> {
  try {
    return await kisaki.library.collections.create({
      name,
      isDynamic: false,
      isNsfw: false
    })
  } catch (error) {
    const retry = await findStaticCollectionByName(name)
    if (retry) {
      return retry
    }
    throw error
  }
}

function normalizeCollectionName(name: string): string {
  const normalized = name.trim()
  if (!normalized) {
    throw new BangumiExtensionError(
      'bangumi_validation',
      'Bangumi 目录标题为空，无法创建本地合集。'
    )
  }
  return normalized
}

async function importGameFromCollection(
  profileId: string,
  collection: BangumiUserCollection
): Promise<{ gameId: string; isNew: boolean }> {
  const subjectId = readCollectionSubjectId(collection)
  const subject = collection.subject
  const title = subject
    ? formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId)
    : `Bangumi ${subjectId}`

  return kisaki.ingest.games.addFromScraper(profileId, {
    name: title,
    knownIds: [{ source: BANGUMI_SOURCE_ID, id: String(subjectId) }]
  })
}

async function importGameFromIndexSubject(
  profileId: string,
  subject: BangumiIndexSubject
): Promise<{ gameId: string; isNew: boolean }> {
  const subjectId = normalizePositiveInteger(subject.id)
  if (!subjectId) {
    throw new BangumiExtensionError('bangumi_validation', 'Bangumi 目录条目缺少有效 subject ID。')
  }

  return kisaki.ingest.games.addFromScraper(profileId, {
    name: formatBangumiSubjectTitle(subject.name_cn, subject.name, subjectId),
    knownIds: [{ source: BANGUMI_SOURCE_ID, id: String(subjectId) }]
  })
}

async function requireLibraryGame(gameId: string): Promise<LibraryGame> {
  const game = await kisaki.library.games.get(gameId)
  if (!game) {
    throw new BangumiExtensionError('library_update_failed', '导入后的本地游戏不存在。')
  }
  return game
}

async function applyMyCollectionLocalUpdate({
  game,
  collection,
  fields,
  targetCollection
}: {
  game: LibraryGame
  collection: BangumiUserCollection
  fields: BangumiImportMyCollectionsArgs['fields']
  targetCollection: ResolvedImportTargetCollection | undefined
}): Promise<void> {
  const plan = await buildMyCollectionLocalUpdatePlan({
    game,
    collection,
    fields,
    targetCollection
  })

  if (Object.keys(plan.patch).length > 0) {
    await kisaki.library.games.update(game.id, plan.patch)
  }

  for (const tagName of plan.tagNames) {
    const tag = await ensureTag(tagName)
    await ensureGameTag(game.id, tag.id)
  }

  if (plan.targetCollection) {
    await ensureGameInTargetCollection(game.id, plan.targetCollection)
  }
}

async function buildMyCollectionLocalUpdatePlan({
  game,
  collection,
  fields,
  targetCollection
}: {
  game: LibraryGame
  collection: BangumiUserCollection
  fields: BangumiImportMyCollectionsArgs['fields']
  targetCollection: ResolvedImportTargetCollection | undefined
}): Promise<MyCollectionLocalUpdatePlan> {
  const patch: LibraryGamePatch = {}
  const localValues: string[] = []
  const remoteValues: string[] = []
  let tagNames: readonly string[] = []
  let resolvedTargetCollection: ResolvedImportTargetCollection | undefined

  if (fields.status) {
    const targetStatus = mapCollectionTypeToGameStatus(collection.type)
    if (game.status !== targetStatus) {
      patch.status = targetStatus
      localValues.push(formatGameStatus(game.status))
      remoteValues.push(formatCollectionType(collection.type))
    }
  }

  if (fields.score) {
    const localScore = normalizeLocalScore(game.score)
    const targetScore = normalizeCollectionScoreForImport(collection.rate)
    if (localScore !== targetScore) {
      patch.score = targetScore
      localValues.push(formatLocalScore(localScore))
      remoteValues.push(formatLocalScore(targetScore))
    }
  }

  if (fields.tags) {
    const targetTagNames = normalizeCollectionTagNames(collection.tags)
    const currentTagNames = await listGameTagNames(game.id)
    const missingTags = targetTagNames.filter((tagName) => !currentTagNames.has(tagName))
    if (missingTags.length > 0) {
      tagNames = missingTags
      localValues.push(formatTagNames([...currentTagNames]))
      remoteValues.push(formatTagNames(targetTagNames))
    }
  }

  const hasTargetCollectionRelation = targetCollection?.id
    ? await hasGameCollectionRelation(game.id, targetCollection.id)
    : false
  if (targetCollection && !hasTargetCollectionRelation) {
    resolvedTargetCollection = targetCollection
    localValues.push('未加入合集')
    remoteValues.push(formatTargetCollectionAction(targetCollection))
  }

  return {
    patch,
    tagNames,
    targetCollection: resolvedTargetCollection,
    localValues,
    remoteValues
  }
}

function hasMyCollectionLocalChanges(plan: MyCollectionLocalUpdatePlan): boolean {
  return (
    Object.keys(plan.patch).length > 0 ||
    plan.tagNames.length > 0 ||
    plan.targetCollection !== undefined
  )
}

async function listGameTagNames(gameId: string): Promise<ReadonlySet<string>> {
  const relations = await kisaki.library.relations.list({
    entity: { entityType: 'game', id: gameId },
    kinds: ['game-tag']
  })
  const tagIds = [...new Set(relations.map((relation) => relation.to.id))]
  if (tagIds.length === 0) {
    return new Set()
  }

  const tags = await kisaki.library.tags.list({
    ids: tagIds,
    includeNsfw: true
  })
  return new Set(tags.map((tag) => tag.name))
}

async function ensureTag(name: string): Promise<LibraryTag> {
  const existing = await findTagByName(name)
  if (existing) {
    return existing
  }

  try {
    return await kisaki.library.tags.create({ name, isNsfw: false })
  } catch (error) {
    const retry = await findTagByName(name)
    if (retry) {
      return retry
    }
    throw error
  }
}

async function findTagByName(name: string): Promise<LibraryTag | undefined> {
  const tags = await kisaki.library.tags.list({
    search: name,
    includeNsfw: true
  })
  return tags.find((tag) => tag.name === name)
}

async function ensureGameTag(gameId: string, tagId: string): Promise<void> {
  const relations = await kisaki.library.relations.list({
    entity: { entityType: 'game', id: gameId },
    relatedEntity: { entityType: 'tag', id: tagId },
    kinds: ['game-tag']
  })
  if (relations.length > 0) {
    return
  }

  await kisaki.library.relations.create({
    kind: 'game-tag',
    from: { entityType: 'game', id: gameId },
    to: { entityType: 'tag', id: tagId },
    metadata: { order: 0 }
  })
}

async function ensureGameInTargetCollection(
  gameId: string,
  targetCollection: ResolvedImportTargetCollection
): Promise<void> {
  let collectionId = targetCollection.id
  if (!collectionId) {
    const collection = await createStaticCollectionByName(targetCollection.name)
    targetCollection.id = collection.id
    targetCollection.name = collection.name
    targetCollection.willCreate = false
    collectionId = collection.id
  }

  await ensureGameInCollection(gameId, collectionId)
}

async function ensureGameInCollection(gameId: string, collectionId: string): Promise<void> {
  if (await hasGameCollectionRelation(gameId, collectionId)) {
    return
  }

  await kisaki.library.relations.create({
    kind: 'collection-game',
    from: { entityType: 'collection', id: collectionId },
    to: { entityType: 'game', id: gameId },
    metadata: { order: 0 }
  })
}

async function hasGameCollectionRelation(gameId: string, collectionId: string): Promise<boolean> {
  const relations = await kisaki.library.relations.list({
    entity: { entityType: 'game', id: gameId },
    relatedEntity: { entityType: 'collection', id: collectionId },
    kinds: ['collection-game']
  })
  return relations.length > 0
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

function normalizeBangumiRate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.max(1, Math.trunc(value)))
    : undefined
}

function normalizeLocalScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeLocalScoreAsBangumiRate(value: unknown): number | undefined {
  const score = normalizeLocalScore(value)
  return score !== null && score > 0 ? Math.min(10, Math.max(1, Math.round(score / 10))) : undefined
}

function normalizeCollectionScoreForImport(value: unknown): number | null {
  const rate = normalizeBangumiRate(value)
  return rate === undefined ? null : rate * 10
}

function normalizeCollectionTagNames(tags: readonly string[] | undefined): readonly string[] {
  const names: string[] = []
  const seen = new Set<string>()

  for (const tag of tags ?? []) {
    const name = tag.trim()
    if (name && !seen.has(name)) {
      seen.add(name)
      names.push(name)
    }
  }

  return names
}

function mapCollectionTypeToGameStatus(type: BangumiCollectionType): LibraryGameStatus {
  switch (type) {
    case 1:
      return 'notStarted'
    case 2:
      return 'completed'
    case 3:
      return 'inProgress'
    case 4:
    case 5:
      return 'shelved'
  }
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

function formatGameStatus(value: LibraryGameStatus): string {
  switch (value) {
    case 'notStarted':
      return '想玩'
    case 'inProgress':
      return '在玩'
    case 'partial':
      return '部分通关'
    case 'completed':
      return '玩过'
    case 'multiple':
      return '多周目'
    case 'shelved':
      return '搁置'
  }
}

function formatImportCollectionRemoteValue(
  collection: BangumiUserCollection,
  fields: BangumiImportMyCollectionsArgs['fields'],
  targetCollection: ResolvedImportTargetCollection | undefined
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

  if (targetCollection) {
    values.push(formatTargetCollectionAction(targetCollection))
  }

  return values.length > 0 ? values.join('；') : formatCollectionType(collection.type)
}

function formatTargetCollectionAction(targetCollection: ResolvedImportTargetCollection): string {
  return `加入${formatTargetCollectionValue(targetCollection)}`
}

function formatTargetCollectionValue(targetCollection: ResolvedImportTargetCollection): string {
  const creationNote = targetCollection.willCreate ? '（将创建）' : ''
  return `合集：${targetCollection.name}${creationNote}`
}

function formatCollectionScore(score: number | undefined): string {
  return formatLocalScore(normalizeCollectionScoreForImport(score))
}

function formatLocalScore(score: number | null): string {
  return score === null ? '未评分' : (score / 10).toFixed(1)
}

function formatCollectionTags(tags: readonly string[] | undefined): string {
  const normalized = (tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  return normalized.length > 0 ? normalized.join('、') : '无'
}

function formatTagNames(tagNames: readonly string[]): string {
  return tagNames.length > 0 ? tagNames.join('、') : '无'
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

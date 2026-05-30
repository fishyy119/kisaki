import type {
  CommandContributionExecuteEvent,
  CommandRegistrar,
  Disposable,
  SerializableRecord
} from '@kisaki3/extension-sdk'
import {
  normalizeAuthRefreshArgs,
  normalizeChangedItemsSyncArgs,
  normalizeFullSyncArgs,
  normalizeImportIndexArgs,
  normalizeImportCollectionsArgs
} from './args'
import type { BangumiJobEvent, JobRunner } from './runner'

export const BANGUMI_COMMAND_IDS = {
  authRefresh: 'bangumi.auth.refresh',
  syncChangedItems: 'bangumi.sync.changed-items',
  syncFull: 'bangumi.sync.full',
  importCollections: 'bangumi.import.collections',
  importIndex: 'bangumi.import.index'
} as const

export type BangumiCommandId = (typeof BANGUMI_COMMAND_IDS)[keyof typeof BANGUMI_COMMAND_IDS]

export function registerBangumiJobCommands(
  commands: CommandRegistrar,
  runner: JobRunner,
  signal: AbortSignal
): readonly Disposable[] {
  const registrations = [
    commands.register({
      id: BANGUMI_COMMAND_IDS.authRefresh,
      title: 'Bangumi 刷新凭据',
      description: '刷新 Bangumi token 并验证当前账号',
      defaultArgs: {
        forceRefresh: true,
        verifyAccount: true
      },
      argsSchema: createObjectArgsSchema({
        forceRefresh: 'boolean',
        verifyAccount: 'boolean'
      }),
      execute(args, event) {
        return runner.runAuthRefresh(
          normalizeAuthRefreshArgs(args),
          toBangumiJobEvent(event, signal)
        )
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.syncChangedItems,
      title: 'Bangumi 同步变更条目',
      description: '同步扩展运行期队列中的本地条目变更',
      defaultArgs: {
        scope: 'game',
        dryRun: false,
        limit: 500
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        dryRun: 'boolean',
        limit: 'number'
      }),
      execute(args, event) {
        return runner.runChangedItemsSync(
          normalizeChangedItemsSyncArgs(args),
          toBangumiJobEvent(event, signal)
        )
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.syncFull,
      title: 'Bangumi 全量同步',
      description: '扫描本地游戏并同步 Bangumi 收藏状态与评分',
      defaultArgs: {
        scope: 'game',
        dryRun: true,
        updateExisting: true,
        playStatusEnabled: true,
        scoreEnabled: true,
        clearRemoteScoreWhenEmpty: false,
        batchSize: 100
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        dryRun: 'boolean',
        updateExisting: 'boolean',
        batchSize: 'number',
        playStatusEnabled: 'boolean',
        scoreEnabled: 'boolean',
        clearRemoteScoreWhenEmpty: 'boolean'
      }),
      execute(args, event) {
        return runner.runFullSync(normalizeFullSyncArgs(args), toBangumiJobEvent(event, signal))
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.importCollections,
      title: 'Bangumi 导入我的收藏',
      description: '按媒体类型导入当前 Bangumi 用户收藏',
      defaultArgs: {
        scope: 'game',
        dryRun: true,
        profileId: '',
        collectionTypes: [1, 2, 3, 4, 5],
        fields: {
          status: false,
          score: false,
          tags: false
        },
        patchExisting: false,
        targetCollection: {
          kind: 'none'
        }
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        dryRun: 'boolean',
        profileId: 'string',
        collectionTypes: 'array',
        fields: 'object',
        patchExisting: 'boolean',
        targetCollection: 'object'
      }),
      execute(args, event) {
        return runner.runImportCollections(
          normalizeImportCollectionsArgs(args),
          toBangumiJobEvent(event, signal)
        )
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.importIndex,
      title: 'Bangumi 导入目录',
      description: '按媒体类型导入或预览指定 Bangumi 目录条目',
      defaultArgs: {
        scope: 'game',
        dryRun: true,
        profileId: '',
        indexInput: '',
        patchExisting: false,
        targetCollection: {
          kind: 'none'
        }
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        dryRun: 'boolean',
        profileId: 'string',
        indexInput: 'string',
        patchExisting: 'boolean',
        targetCollection: 'object'
      }),
      execute(args, event) {
        return runner.runImportIndex(
          normalizeImportIndexArgs(args),
          toBangumiJobEvent(event, signal)
        )
      }
    })
  ] satisfies readonly Disposable[]

  return registrations
}

function toBangumiJobEvent(
  event: CommandContributionExecuteEvent,
  signal: AbortSignal
): BangumiJobEvent {
  return {
    commandId: event.commandId,
    source: event.source,
    signal
  }
}

function createObjectArgsSchema(properties: Record<string, string>): SerializableRecord {
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, type]) => [key, { type }])
    ) as SerializableRecord
  }
}

export function isBangumiCommandId(value: string): value is BangumiCommandId {
  return Object.values(BANGUMI_COMMAND_IDS).includes(value as BangumiCommandId)
}

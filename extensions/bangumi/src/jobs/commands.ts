import type { CommandRegistrar, Disposable, SerializableRecord } from '@kisaki/extension-sdk'
import {
  normalizeAuthRefreshArgs,
  normalizeChangedGamesSyncArgs,
  normalizeFullSyncArgs,
  normalizeImportIndexArgs,
  normalizeImportMyCollectionsArgs
} from './args'
import type { JobRunner } from './runner'

export const BANGUMI_COMMAND_IDS = {
  authRefresh: 'bangumi.auth.refresh',
  syncChangedGames: 'bangumi.sync.changed-games',
  syncFull: 'bangumi.sync.full',
  importMyCollections: 'bangumi.import.my-collections',
  importIndex: 'bangumi.import.index'
} as const

export type BangumiCommandId = (typeof BANGUMI_COMMAND_IDS)[keyof typeof BANGUMI_COMMAND_IDS]

export function registerBangumiJobCommands(
  commands: CommandRegistrar,
  runner: JobRunner
): readonly Disposable[] {
  const registrations = [
    commands.register({
      id: BANGUMI_COMMAND_IDS.authRefresh,
      title: 'Bangumi 刷新凭据',
      description: '刷新 Bangumi token 并验证当前账号',
      cancelable: true,
      defaultArgs: {
        forceRefresh: true,
        verifyAccount: true
      },
      argsSchema: createObjectArgsSchema({
        forceRefresh: 'boolean',
        verifyAccount: 'boolean'
      }),
      execute(args, event) {
        return runner.runAuthRefresh(normalizeAuthRefreshArgs(args), event)
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.syncChangedGames,
      title: 'Bangumi 同步变更游戏',
      description: '同步扩展运行期队列中的本地游戏变更',
      cancelable: true,
      defaultArgs: {
        dryRun: false,
        limit: 500
      },
      argsSchema: createObjectArgsSchema({
        dryRun: 'boolean',
        limit: 'number'
      }),
      execute(args, event) {
        return runner.runChangedGamesSync(normalizeChangedGamesSyncArgs(args), event)
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.syncFull,
      title: 'Bangumi 全量同步',
      description: '扫描本地游戏并同步 Bangumi 收藏状态与评分',
      cancelable: true,
      defaultArgs: {
        dryRun: true,
        updateExisting: true,
        playStatusEnabled: true,
        scoreEnabled: true,
        clearRemoteScoreWhenEmpty: false,
        batchSize: 100
      },
      argsSchema: createObjectArgsSchema({
        dryRun: 'boolean',
        updateExisting: 'boolean',
        batchSize: 'number',
        playStatusEnabled: 'boolean',
        scoreEnabled: 'boolean',
        clearRemoteScoreWhenEmpty: 'boolean'
      }),
      execute(args, event) {
        return runner.runFullSync(normalizeFullSyncArgs(args), event)
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.importMyCollections,
      title: 'Bangumi 导入我的收藏',
      description: '导入当前 Bangumi 用户的游戏收藏',
      cancelable: true,
      defaultArgs: {
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
        },
        concurrency: 4
      },
      argsSchema: createObjectArgsSchema({
        dryRun: 'boolean',
        profileId: 'string',
        collectionTypes: 'array',
        fields: 'object',
        patchExisting: 'boolean',
        targetCollection: 'object',
        concurrency: 'number'
      }),
      execute(args, event) {
        return runner.runImportMyCollections(normalizeImportMyCollectionsArgs(args), event)
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.importIndex,
      title: 'Bangumi 导入目录',
      description: '导入指定 Bangumi 目录中的游戏条目',
      cancelable: true,
      defaultArgs: {
        dryRun: true,
        profileId: '',
        indexInput: '',
        patchExisting: false,
        targetCollection: {
          kind: 'none'
        },
        concurrency: 4
      },
      argsSchema: createObjectArgsSchema({
        dryRun: 'boolean',
        profileId: 'string',
        indexInput: 'string',
        patchExisting: 'boolean',
        targetCollection: 'object',
        concurrency: 'number'
      }),
      execute(args, event) {
        return runner.runImportIndex(normalizeImportIndexArgs(args), event)
      }
    })
  ] satisfies readonly Disposable[]

  return registrations
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

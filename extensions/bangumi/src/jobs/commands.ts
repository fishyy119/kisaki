import type {
  CommandContributionExecuteEvent,
  CommandRegistrar,
  Disposable,
  ExtensionTaskRunHandle,
  JsonObject
} from '@kisaki3/extension-sdk'
import { kisaki, isExtensionTaskRunCancellation } from '@kisaki3/extension-sdk'
import {
  normalizeAuthRefreshArgs,
  normalizeChangedItemsSyncArgs,
  normalizeFullSyncArgs,
  normalizeImportIndexArgs,
  normalizeImportCollectionsArgs
} from './args'
import type { JobRunner } from './runner'
import { BangumiExtensionError } from '../shared/errors'

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
        return startBangumiTaskRun({
          event,
          signal,
          operation: 'authRefresh',
          title: 'Bangumi 刷新凭据',
          description: '刷新 Bangumi token 并验证当前账号',
          run: (run) =>
            runner.runAuthRefresh(normalizeAuthRefreshArgs(args), {
              commandId: event.commandId,
              run
            })
        })
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.syncChangedItems,
      title: 'Bangumi 同步变更条目',
      description: '同步扩展运行期队列中的本地条目变更',
      defaultArgs: {
        scope: 'game',
        limit: 500
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        limit: 'number'
      }),
      execute(args, event) {
        const normalized = normalizeChangedItemsSyncArgs(args)
        return startBangumiTaskRun({
          event,
          signal,
          operation: 'sync.changedItems',
          title: 'Bangumi 同步变更条目',
          description: '同步扩展运行期队列中的本地条目变更',
          run: (run) =>
            runner.runChangedItemsSync(normalized, {
              commandId: event.commandId,
              run
            })
        })
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.syncFull,
      title: 'Bangumi 全量同步',
      description: '扫描本地游戏并同步 Bangumi 收藏状态与评分',
      defaultArgs: {
        scope: 'game',
        updateExisting: true,
        playStatusEnabled: true,
        scoreEnabled: true,
        clearRemoteScoreWhenEmpty: false,
        batchSize: 100
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        updateExisting: 'boolean',
        batchSize: 'number',
        playStatusEnabled: 'boolean',
        scoreEnabled: 'boolean',
        clearRemoteScoreWhenEmpty: 'boolean'
      }),
      execute(args, event) {
        const normalized = normalizeFullSyncArgs(args)
        return startBangumiTaskRun({
          event,
          signal,
          operation: 'fullSync',
          title: 'Bangumi 全量同步',
          description: '扫描本地游戏并同步 Bangumi 收藏状态与评分',
          run: (run) =>
            runner.runFullSync(normalized, {
              commandId: event.commandId,
              run
            })
        })
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.importCollections,
      title: 'Bangumi 导入我的收藏',
      description: '按媒体类型导入当前 Bangumi 用户收藏',
      defaultArgs: {
        scope: 'game',
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
        profileId: 'string',
        collectionTypes: 'array',
        fields: 'object',
        patchExisting: 'boolean',
        targetCollection: 'object'
      }),
      execute(args, event) {
        const normalized = normalizeImportCollectionsArgs(args)
        return startBangumiTaskRun({
          event,
          signal,
          operation: 'import.collections',
          title: 'Bangumi 导入我的收藏',
          description: '按媒体类型导入当前 Bangumi 用户收藏',
          run: (run) =>
            runner.runImportCollections(normalized, {
              commandId: event.commandId,
              run
            })
        })
      }
    }),
    commands.register({
      id: BANGUMI_COMMAND_IDS.importIndex,
      title: 'Bangumi 导入目录',
      description: '按媒体类型导入指定 Bangumi 目录条目',
      defaultArgs: {
        scope: 'game',
        profileId: '',
        indexInput: '',
        patchExisting: false,
        targetCollection: {
          kind: 'none'
        }
      },
      argsSchema: createObjectArgsSchema({
        scope: 'string',
        profileId: 'string',
        indexInput: 'string',
        patchExisting: 'boolean',
        targetCollection: 'object'
      }),
      execute(args, event) {
        const normalized = normalizeImportIndexArgs(args)
        return startBangumiTaskRun({
          event,
          signal,
          operation: 'import.index',
          title: 'Bangumi 导入目录',
          description: '按媒体类型导入指定 Bangumi 目录条目',
          run: (run) =>
            runner.runImportIndex(normalized, {
              commandId: event.commandId,
              run
            })
        })
      }
    })
  ] satisfies readonly Disposable[]

  return registrations
}

function createObjectArgsSchema(properties: Record<string, string>): JsonObject {
  return {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(properties).map(([key, type]) => [key, { type }])
    ) as JsonObject
  }
}

export function isBangumiCommandId(value: string): value is BangumiCommandId {
  return Object.values(BANGUMI_COMMAND_IDS).includes(value as BangumiCommandId)
}

async function startBangumiTaskRun(options: {
  event: CommandContributionExecuteEvent
  signal: AbortSignal
  operation: string
  title: string
  description: string
  run(run: ExtensionTaskRunHandle): Promise<unknown>
}): Promise<JsonObject> {
  if (options.signal.aborted) {
    throw new BangumiExtensionError('job_cancelled', 'Bangumi job 已取消。')
  }

  const run = await kisaki.taskRuns.create({
    operation: options.operation,
    title: options.title,
    description: options.description,
    initiator: options.event.source,
    subject: {
      type: 'command',
      id: options.event.commandId,
      labelSnapshot: options.title
    },
    controls: {
      cancelable: true,
      pausable: false
    },
    presentation: {
      notify: {
        enabled: true,
        title: options.title,
        showResult: true,
        closable: true
      }
    }
  })

  void options.run(run).catch((error) => {
    if (!isExtensionTaskRunCancellation(error)) {
      void error
    }
  })

  return { runId: run.id }
}

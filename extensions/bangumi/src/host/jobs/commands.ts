import type {
  CommandContributionExecuteEvent,
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  TaskRunHandle,
  JsonObject
} from '@kisaki3/extension-sdk'
import { createCancellationError, kisaki, isTaskRunCancellation } from '@kisaki3/extension-sdk'
import { m } from '../i18n'
import {
  normalizeAuthRefreshArgs,
  normalizeChangedItemsSyncArgs,
  normalizeFullSyncArgs,
  normalizeImportIndexArgs,
  normalizeImportCollectionsArgs
} from './args'
import type { BangumiJobEvents } from './events'
import type { JobRunner } from './runner'

export const BANGUMI_COMMAND_IDS = {
  authRefresh: 'bangumi.auth.refresh',
  syncChangedItems: 'bangumi.sync.changed-items',
  syncFull: 'bangumi.sync.full',
  importCollections: 'bangumi.import.collections',
  importIndex: 'bangumi.import.index'
} as const

export type BangumiCommandId = (typeof BANGUMI_COMMAND_IDS)[keyof typeof BANGUMI_COMMAND_IDS]

export interface BangumiJobCommandsInput {
  commands: CommandRegistrar
  runner: JobRunner
  events: BangumiJobEvents
  signal: AbortSignal
  logger: ExtensionLogger
}

export function registerBangumiJobCommands(input: BangumiJobCommandsInput): readonly Disposable[] {
  const { commands, runner, events, signal, logger } = input
  const registrations = [
    commands.register({
      id: BANGUMI_COMMAND_IDS.authRefresh,
      title: m().commands.authRefresh.title,
      description: m().commands.authRefresh.description,
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
          events,
          logger,
          operation: 'authRefresh',
          title: m().commands.authRefresh.title,
          description: m().commands.authRefresh.description,
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
      title: m().commands.syncChanged.title,
      description: m().commands.syncChanged.description,
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
          events,
          logger,
          operation: 'sync.changedItems',
          title: m().commands.syncChanged.title,
          description: m().commands.syncChanged.description,
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
      title: m().commands.syncFull.title,
      description: m().commands.syncFull.description,
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
          events,
          logger,
          operation: 'fullSync',
          title: m().commands.syncFull.title,
          description: m().commands.syncFull.description,
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
      title: m().commands.importCollections.title,
      description: m().commands.importCollections.description,
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
          events,
          logger,
          operation: 'import.collections',
          title: m().commands.importCollections.title,
          description: m().commands.importCollections.description,
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
      title: m().commands.importIndex.title,
      description: m().commands.importIndex.description,
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
          events,
          logger,
          operation: 'import.index',
          title: m().commands.importIndex.title,
          description: m().commands.importIndex.description,
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
  events: BangumiJobEvents
  logger: ExtensionLogger
  operation: string
  title: string
  description: string
  run(run: TaskRunHandle): Promise<unknown>
}): Promise<JsonObject> {
  if (options.signal.aborted) {
    throw createCancellationError(m().errors.jobCancelled)
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

  options.events.emit({ type: 'started', commandId: options.event.commandId })
  void options
    .run(run)
    .catch((error: unknown) => {
      // The job lifecycle finishes the run itself; anything surfacing here is
      // a launcher-level defect worth logging.
      if (!isTaskRunCancellation(error)) {
        options.logger.warn('Bangumi job launcher failed.', {
          commandId: options.event.commandId,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    })
    .finally(() => {
      options.events.emit({ type: 'finished', commandId: options.event.commandId })
    })

  return { runId: run.id }
}

import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import type { NeodbClient } from '../api/client'
import { m } from '../i18n'
import type { ImportOptions } from '../import/runner'
import type { NeodbTasks } from '../tasks'

export const NEODB_COMMAND_IDS = {
  verifyAccount: 'neodb.auth.verify',
  pushAll: 'neodb.sync.push-all',
  importShelf: 'neodb.import.shelf'
} as const

export type NeodbCommandId = (typeof NEODB_COMMAND_IDS)[keyof typeof NEODB_COMMAND_IDS]

export interface NeodbJobCommandsInput {
  commands: CommandRegistrar
  tasks: NeodbTasks
  client: NeodbClient
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. Push and
 * import delegate to the task-run launchers; the account check runs inline
 * because it is a single request with no progress to report.
 */
export function registerNeodbJobCommands(input: NeodbJobCommandsInput): readonly Disposable[] {
  const { commands, tasks, client, signal } = input

  return [
    commands.register({
      id: NEODB_COMMAND_IDS.verifyAccount,
      title: m().commands.verifyAccount.title,
      description: m().commands.verifyAccount.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        // getOwnUser throws the localized auth error when no session exists.
        const user = await client.getOwnUser({ signal })
        const userName = user.username?.trim() || 'unknown'
        return { userName, displayName: user.display_name?.trim() || userName }
      }
    }),
    commands.register({
      id: NEODB_COMMAND_IDS.pushAll,
      title: m().commands.pushAll.title,
      description: m().commands.pushAll.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        const { runId } = await tasks.startPushAll()
        return { runId }
      }
    }),
    commands.register({
      id: NEODB_COMMAND_IDS.importShelf,
      title: m().commands.importShelf.title,
      description: m().commands.importShelf.description,
      defaultArgs: {
        updateExisting: true,
        createMissing: false
      },
      argsSchema: {
        type: 'object',
        properties: {
          updateExisting: { type: 'boolean' },
          createMissing: { type: 'boolean' },
          profileId: { type: 'string' }
        }
      },
      async execute(args) {
        const { runId } = await tasks.startImport(normalizeImportArgs(args))
        return { runId }
      }
    })
  ]
}

export function isNeodbCommandId(value: string): value is NeodbCommandId {
  return Object.values(NEODB_COMMAND_IDS).includes(value as NeodbCommandId)
}

/**
 * Total-parse of command args: an automation edited by hand still yields a
 * runnable import. Creating entries stays off without a profile to scrape
 * them through.
 */
function normalizeImportArgs(args: JsonObject): ImportOptions {
  const profileId =
    typeof args.profileId === 'string' && args.profileId ? args.profileId : undefined

  return {
    updateExisting: args.updateExisting !== false,
    createMissing: args.createMissing === true && profileId !== undefined,
    ...(profileId !== undefined ? { profileId } : {})
  }
}

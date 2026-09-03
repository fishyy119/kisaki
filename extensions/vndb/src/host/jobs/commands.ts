import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import type { VndbClient } from '../api/client'
import type { TokenStore } from '../auth/token'
import { m } from '../i18n'
import type { ImportOptions } from '../import/runner'
import type { VndbTasks } from '../tasks'
import { VndbExtensionError } from '../utils/errors'

export const VNDB_COMMAND_IDS = {
  verifyAccount: 'vndb.auth.verify',
  pushAll: 'vndb.sync.push-all',
  importList: 'vndb.import.list'
} as const

export type VndbCommandId = (typeof VNDB_COMMAND_IDS)[keyof typeof VNDB_COMMAND_IDS]

export interface VndbJobCommandsInput {
  commands: CommandRegistrar
  tasks: VndbTasks
  client: VndbClient
  tokens: TokenStore
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. Push and
 * import delegate to the task-run launchers; the account check runs inline
 * because it is a single request with no progress to report.
 */
export function registerVndbJobCommands(input: VndbJobCommandsInput): readonly Disposable[] {
  const { commands, tasks, client, tokens, signal } = input

  return [
    commands.register({
      id: VNDB_COMMAND_IDS.verifyAccount,
      title: m().commands.verifyAccount.title,
      description: m().commands.verifyAccount.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        if (!(await tokens.has())) {
          throw new VndbExtensionError('token_required', m().errors.tokenRequired)
        }

        const auth = await client.getAuthInfo({ signal })
        return { userId: auth.id, username: auth.username }
      }
    }),
    commands.register({
      id: VNDB_COMMAND_IDS.pushAll,
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
      id: VNDB_COMMAND_IDS.importList,
      title: m().commands.importList.title,
      description: m().commands.importList.description,
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

export function isVndbCommandId(value: string): value is VndbCommandId {
  return Object.values(VNDB_COMMAND_IDS).includes(value as VndbCommandId)
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

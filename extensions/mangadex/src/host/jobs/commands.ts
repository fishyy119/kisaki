import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import type { MangadexClient } from '../api/client'
import type { TokenManager } from '../auth/token-manager'
import { m } from '../i18n'
import type { ImportOptions } from '../import/runner'
import type { MangadexTasks } from '../tasks'
import { MangadexExtensionError } from '../utils/errors'

export const MANGADEX_COMMAND_IDS = {
  verifyAccount: 'mangadex.auth.verify',
  pushAll: 'mangadex.sync.push-all',
  importStatuses: 'mangadex.import.statuses'
} as const

export type MangadexCommandId = (typeof MANGADEX_COMMAND_IDS)[keyof typeof MANGADEX_COMMAND_IDS]

export interface MangadexJobCommandsInput {
  commands: CommandRegistrar
  tasks: MangadexTasks
  client: MangadexClient
  tokenManager: TokenManager
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. Push and
 * import delegate to the task-run launchers; the account check runs inline
 * because it is a single request with no progress to report.
 */
export function registerMangadexJobCommands(
  input: MangadexJobCommandsInput
): readonly Disposable[] {
  const { commands, tasks, client, tokenManager, signal } = input

  return [
    commands.register({
      id: MANGADEX_COMMAND_IDS.verifyAccount,
      title: m().commands.verifyAccount.title,
      description: m().commands.verifyAccount.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        if (!(await tokenManager.hasCredentials())) {
          throw new MangadexExtensionError('auth_required', m().errors.authRequired)
        }

        const user = await client.getOwnUser({ signal })
        return { userId: user.id, userName: user.attributes?.username?.trim() || user.id }
      }
    }),
    commands.register({
      id: MANGADEX_COMMAND_IDS.pushAll,
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
      id: MANGADEX_COMMAND_IDS.importStatuses,
      title: m().commands.importStatuses.title,
      description: m().commands.importStatuses.description,
      defaultArgs: {
        updateExisting: true,
        createMissing: false,
        importScores: true
      },
      argsSchema: {
        type: 'object',
        properties: {
          updateExisting: { type: 'boolean' },
          createMissing: { type: 'boolean' },
          importScores: { type: 'boolean' },
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

export function isMangadexCommandId(value: string): value is MangadexCommandId {
  return Object.values(MANGADEX_COMMAND_IDS).includes(value as MangadexCommandId)
}

/**
 * Total-parse of command args: an automation edited by hand still yields a
 * runnable import. Creating entries stays off without a profile to scrape
 * them through.
 */
function normalizeImportArgs(args: JsonObject): ImportOptions {
  const profileId = typeof args.profileId === 'string' && args.profileId ? args.profileId : undefined

  return {
    updateExisting: args.updateExisting !== false,
    createMissing: args.createMissing === true && profileId !== undefined,
    importScores: args.importScores !== false,
    ...(profileId !== undefined ? { profileId } : {})
  }
}

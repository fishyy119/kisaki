import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import type { MalOfficialClient } from '../api/official-client'
import type { TokenStore } from '../auth/token-store'
import { m } from '../i18n'
import type { ImportOptions } from '../import/runner'
import type { MalTasks } from '../tasks'
import { MalExtensionError } from '../utils/errors'

export const MAL_COMMAND_IDS = {
  verifyAccount: 'mal.auth.verify',
  pushAll: 'mal.sync.push-all',
  importLists: 'mal.import.lists'
} as const

export type MalCommandId = (typeof MAL_COMMAND_IDS)[keyof typeof MAL_COMMAND_IDS]

export interface MalJobCommandsInput {
  commands: CommandRegistrar
  tasks: MalTasks
  client: MalOfficialClient
  tokenStore: TokenStore
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. Push and
 * import delegate to the task-run launchers; the account check runs inline
 * because it is a single request (and exercises the automatic token refresh).
 */
export function registerMalJobCommands(input: MalJobCommandsInput): readonly Disposable[] {
  const { commands, tasks, client, tokenStore, signal } = input

  return [
    commands.register({
      id: MAL_COMMAND_IDS.verifyAccount,
      title: m().commands.verifyAccount.title,
      description: m().commands.verifyAccount.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        const token = await tokenStore.getToken()
        if (!token) {
          throw new MalExtensionError('auth_required', m().errors.authRequired)
        }

        const user = await client.getOwnUser({ signal })
        return { userId: user.id, userName: user.name?.trim() || String(user.id) }
      }
    }),
    commands.register({
      id: MAL_COMMAND_IDS.pushAll,
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
      id: MAL_COMMAND_IDS.importLists,
      title: m().commands.importLists.title,
      description: m().commands.importLists.description,
      defaultArgs: {
        lists: ['anime', 'manga'],
        updateExisting: true,
        createMissing: false
      },
      argsSchema: {
        type: 'object',
        properties: {
          lists: { type: 'array' },
          updateExisting: { type: 'boolean' },
          createMissing: { type: 'boolean' },
          animeProfileId: { type: 'string' },
          comicProfileId: { type: 'string' },
          novelProfileId: { type: 'string' }
        }
      },
      async execute(args) {
        const { runId } = await tasks.startImport(normalizeImportListsArgs(args))
        return { runId }
      }
    })
  ]
}

export function isMalCommandId(value: string): value is MalCommandId {
  return Object.values(MAL_COMMAND_IDS).includes(value as MalCommandId)
}

/**
 * Total-parse of command args: an automation edited by hand still yields a
 * runnable import. Creating entries stays off unless a profile is present for
 * every list it would create from.
 */
function normalizeImportListsArgs(args: JsonObject): ImportOptions {
  const lists: ('anime' | 'manga')[] = []
  if (Array.isArray(args.lists)) {
    for (const value of args.lists) {
      if ((value === 'anime' || value === 'manga') && !lists.includes(value)) {
        lists.push(value)
      }
    }
  }
  if (lists.length === 0) {
    lists.push('anime', 'manga')
  }

  const profileIds: { anime?: string; comic?: string; novel?: string } = {}
  if (typeof args.animeProfileId === 'string' && args.animeProfileId) {
    profileIds.anime = args.animeProfileId
  }
  if (typeof args.comicProfileId === 'string' && args.comicProfileId) {
    profileIds.comic = args.comicProfileId
  }
  if (typeof args.novelProfileId === 'string' && args.novelProfileId) {
    profileIds.novel = args.novelProfileId
  }

  const createProfilesReady =
    (!lists.includes('anime') || profileIds.anime !== undefined) &&
    (!lists.includes('manga') || (profileIds.comic !== undefined && profileIds.novel !== undefined))

  return {
    lists,
    updateExisting: args.updateExisting !== false,
    createMissing: args.createMissing === true && createProfilesReady,
    profileIds
  }
}

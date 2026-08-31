import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import { kisaki } from '@kisaki3/extension-sdk'
import type { AnilistClient } from '../api/client'
import type { TokenStore } from '../auth/token-store'
import { m } from '../i18n'
import type { ImportOptions } from '../import/runner'
import type { AnilistTasks } from '../tasks'
import { AnilistExtensionError, toSafeErrorLog } from '../utils/errors'

export const ANILIST_COMMAND_IDS = {
  verifyAccount: 'anilist.auth.verify',
  pushAll: 'anilist.sync.push-all',
  importLists: 'anilist.import.lists'
} as const

export type AnilistCommandId = (typeof ANILIST_COMMAND_IDS)[keyof typeof ANILIST_COMMAND_IDS]

/** Warn this many days before the roughly year-long token expires. */
const TOKEN_EXPIRY_WARNING_DAYS = 14
const MS_PER_DAY = 86_400_000

export interface AnilistJobCommandsInput {
  commands: CommandRegistrar
  tasks: AnilistTasks
  client: AnilistClient
  tokenStore: TokenStore
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. Push and
 * import delegate to the task-run launchers; the account check runs inline
 * because it is a single request with no progress to report.
 */
export function registerAnilistJobCommands(input: AnilistJobCommandsInput): readonly Disposable[] {
  const { commands, tasks, client, tokenStore, signal, logger } = input

  return [
    commands.register({
      id: ANILIST_COMMAND_IDS.verifyAccount,
      title: m().commands.verifyAccount.title,
      description: m().commands.verifyAccount.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        const token = await tokenStore.getToken()
        if (!token) {
          throw new AnilistExtensionError('auth_required', m().errors.authRequired)
        }

        const viewer = await client.getViewer({ signal })
        await warnWhenTokenExpiresSoon(token.expiresAt, logger)
        return { userId: viewer.id, userName: viewer.name?.trim() || String(viewer.id) }
      }
    }),
    commands.register({
      id: ANILIST_COMMAND_IDS.pushAll,
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
      id: ANILIST_COMMAND_IDS.importLists,
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

export function isAnilistCommandId(value: string): value is AnilistCommandId {
  return Object.values(ANILIST_COMMAND_IDS).includes(value as AnilistCommandId)
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

async function warnWhenTokenExpiresSoon(
  expiresAt: number | undefined,
  logger: ExtensionLogger
): Promise<void> {
  if (expiresAt === undefined) {
    return
  }

  const daysLeft = Math.floor((expiresAt - Date.now()) / MS_PER_DAY)
  if (daysLeft > TOKEN_EXPIRY_WARNING_DAYS) {
    return
  }

  try {
    await kisaki.notify.warning(m().auth.expiresSoonTitle, {
      message: m().auth.expiresSoon({ days: Math.max(daysLeft, 0) })
    })
  } catch (error) {
    logger.warn('AniList token expiry notification failed.', toSafeErrorLog(error))
  }
}

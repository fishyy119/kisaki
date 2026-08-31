import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import type { SteamClient } from '../api/client'
import { m } from '../i18n'
import type { SteamTasks } from '../tasks'
import { SteamExtensionError } from '../utils/errors'

export const STEAM_COMMAND_IDS = {
  verifyAccount: 'steam.auth.verify',
  importOwned: 'steam.import.owned'
} as const

export type SteamCommandId = (typeof STEAM_COMMAND_IDS)[keyof typeof STEAM_COMMAND_IDS]

export interface SteamJobCommandsInput {
  commands: CommandRegistrar
  tasks: SteamTasks
  client: SteamClient
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. The import
 * delegates to the task-run launcher; the account check runs inline because
 * it is a single request with no progress to report.
 */
export function registerSteamJobCommands(input: SteamJobCommandsInput): readonly Disposable[] {
  const { commands, tasks, client, signal } = input

  return [
    commands.register({
      id: STEAM_COMMAND_IDS.verifyAccount,
      title: m().commands.verifyAccount.title,
      description: m().commands.verifyAccount.description,
      defaultArgs: {},
      argsSchema: { type: 'object', properties: {} },
      async execute() {
        // getOwnedGames throws the localized errors for a missing key or id.
        const games = await client.getOwnedGames({ signal })
        return { gameCount: games.length }
      }
    }),
    commands.register({
      id: STEAM_COMMAND_IDS.importOwned,
      title: m().commands.importOwned.title,
      description: m().commands.importOwned.description,
      defaultArgs: { profileId: '' },
      argsSchema: {
        type: 'object',
        properties: {
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

export function isSteamCommandId(value: string): value is SteamCommandId {
  return Object.values(STEAM_COMMAND_IDS).includes(value as SteamCommandId)
}

/** The owned-games import creates entries, so a scraper profile is mandatory. */
function normalizeImportArgs(args: JsonObject): { profileId: string } {
  const profileId = typeof args.profileId === 'string' ? args.profileId.trim() : ''
  if (!profileId) {
    throw new SteamExtensionError('profile_required', m().errors.profileRequired)
  }

  return { profileId }
}

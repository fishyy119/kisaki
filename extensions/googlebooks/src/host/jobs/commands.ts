import type {
  CommandRegistrar,
  Disposable,
  ExtensionLogger,
  JsonObject
} from '@kisaki3/extension-sdk'
import { m } from '../i18n'
import type { ImportOptions } from '../import/runner'
import type { GbooksTasks } from '../tasks'

export const GBOOKS_COMMAND_IDS = {
  importLibrary: 'googlebooks.import.library'
} as const

export type GbooksCommandId = (typeof GBOOKS_COMMAND_IDS)[keyof typeof GBOOKS_COMMAND_IDS]

export interface GbooksJobCommandsInput {
  commands: CommandRegistrar
  tasks: GbooksTasks
  signal: AbortSignal
  logger: ExtensionLogger
}

/**
 * Command surface for automations and the app command service. The import
 * delegates to the task-run launcher, which already guards against overlap.
 */
export function registerGbooksJobCommands(input: GbooksJobCommandsInput): readonly Disposable[] {
  const { commands, tasks } = input

  return [
    commands.register({
      id: GBOOKS_COMMAND_IDS.importLibrary,
      title: m().commands.importLibrary.title,
      description: m().commands.importLibrary.description,
      defaultArgs: {
        includeEbooks: true,
        includeReadingShelves: true,
        updateExisting: true,
        createMissing: false,
        mergeSeries: true
      },
      argsSchema: {
        type: 'object',
        properties: {
          includeEbooks: { type: 'boolean' },
          includeReadingShelves: { type: 'boolean' },
          updateExisting: { type: 'boolean' },
          createMissing: { type: 'boolean' },
          mergeSeries: { type: 'boolean' },
          novelProfileId: { type: 'string' },
          comicProfileId: { type: 'string' }
        }
      },
      async execute(args) {
        const { runId } = await tasks.startImport(normalizeImportArgs(args))
        return { runId }
      }
    })
  ]
}

export function isGbooksCommandId(value: string): value is GbooksCommandId {
  return Object.values(GBOOKS_COMMAND_IDS).includes(value as GbooksCommandId)
}

/**
 * Total-parse of command args: an automation edited by hand still yields a
 * runnable import. Creating entries stays off unless a profile is present for
 * both routed media types.
 */
function normalizeImportArgs(args: JsonObject): ImportOptions {
  const novelProfileId =
    typeof args.novelProfileId === 'string' && args.novelProfileId ? args.novelProfileId : undefined
  const comicProfileId =
    typeof args.comicProfileId === 'string' && args.comicProfileId ? args.comicProfileId : undefined
  const createProfilesReady = novelProfileId !== undefined && comicProfileId !== undefined

  return {
    includeEbooks: args.includeEbooks !== false,
    includeReadingShelves: args.includeReadingShelves !== false,
    updateExisting: args.updateExisting !== false,
    createMissing: args.createMissing === true && createProfilesReady,
    mergeSeries: args.mergeSeries !== false,
    ...(novelProfileId !== undefined ? { novelProfileId } : {}),
    ...(comicProfileId !== undefined ? { comicProfileId } : {})
  }
}

import { Command, Option } from 'commander'
import {
  EXTENSION_STARTERS,
  EXTENSION_WEBVIEW_ADDONS,
  EXTENSION_WEBVIEW_FRAMEWORKS
} from '../../extension-options'
import { runAdd, type AddOptions } from '../actions/add'
import type { ScaffoldCliContext } from '../context'
import { collectList, normalizeWebviewAddons, parseList } from './options'

/** Creates the command that adds an extension to a generated workspace. */
export function createAddCommand(context: ScaffoldCliContext): Command {
  return new Command('add')
    .description('Add an extension to an existing extension workspace')
    .argument('[extension-id]', 'Extension identifier')
    .option('-w, --workspace <dir>', 'Extension workspace root', '.')
    .option('--name <name>', 'Extension name')
    .option('--categories <items>', 'Comma-separated extension categories', parseList)
    .addOption(
      new Option('--starter <starter>', 'Generated host implementation starter').choices([
        ...EXTENSION_STARTERS
      ])
    )
    .addOption(
      new Option('--webview <framework>', 'Generated webview framework').choices([
        ...EXTENSION_WEBVIEW_FRAMEWORKS
      ])
    )
    .option(
      '--webview-addon <addon>',
      `Generated webview addon; repeat or comma-separate (${EXTENSION_WEBVIEW_ADDONS.join(', ')})`,
      collectList
    )
    .option('--description <text>', 'Extension description')
    .option('--author <name>', 'Extension author')
    .option('--no-install', 'Do not install dependencies')
    .option('--commit', 'Commit generated files after successful installation', false)
    .option('-y, --yes', 'Use defaults for omitted values', false)
    .action((extensionId: string | undefined, options: AddCommandOptions) =>
      runAdd(extensionId, normalizeAddOptions(options), context)
    )
}

interface AddCommandOptions extends Omit<AddOptions, 'extensionName' | 'webviewAddons'> {
  name?: string
  webviewAddon?: string[]
}

function normalizeAddOptions(options: AddCommandOptions): AddOptions {
  const { name, ...normalized } = normalizeWebviewAddons(options)
  return name ? { ...normalized, extensionName: name } : normalized
}

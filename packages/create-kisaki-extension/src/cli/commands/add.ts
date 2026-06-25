import { Command, Option } from 'commander'
import { EXTENSION_STARTERS, EXTENSION_WEBVIEWS } from '../../extension-options'
import { runAdd, type AddOptions } from '../actions/add'
import type { ScaffoldCliContext } from '../context'

/** Creates the command that adds an extension to a generated monorepository. */
export function createAddCommand(context: ScaffoldCliContext): Command {
  return new Command('add')
    .description('Add an extension to an existing extension monorepository')
    .argument('[extension-id]', 'Extension identifier')
    .option('-w, --workspace <dir>', 'Extension monorepository root', '.')
    .option('--extension-id <id>', 'Stable extension identifier')
    .option('--package-name <name>', 'Extension npm package name')
    .option('--extension-name <name>', 'User-facing extension name')
    .option('--categories <items>', 'Comma-separated extension categories', parseList)
    .addOption(
      new Option('--starter <starter>', 'Generated host implementation starter').choices([
        ...EXTENSION_STARTERS
      ])
    )
    .addOption(
      new Option('--webview <implementation>', 'Generated webview implementation').choices([
        ...EXTENSION_WEBVIEWS
      ])
    )
    .option('--description <text>', 'Extension description')
    .option('--author <name>', 'Extension author')
    .option('--no-install', 'Do not install dependencies')
    .option('--commit', 'Commit generated files after successful installation', false)
    .option('-y, --yes', 'Use defaults for omitted values', false)
    .action((extensionId: string | undefined, options: AddOptions) =>
      runAdd(extensionId, options, context)
    )
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

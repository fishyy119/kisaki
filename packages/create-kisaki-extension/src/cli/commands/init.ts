import { Command, Option } from 'commander'
import {
  EXTENSION_PUBLISH_PROVIDERS,
  EXTENSION_STARTERS,
  EXTENSION_WEBVIEW_ADDONS,
  EXTENSION_WEBVIEW_FRAMEWORKS
} from '../../extension-options'
import { runInit, type InitOptions } from '../actions/init'
import type { ScaffoldCliContext } from '../context'
import { collectList, normalizeWebviewAddons, parseList } from './options'

/** Creates the command that initializes a new extension repository. */
export function createInitCommand(context: ScaffoldCliContext): Command {
  return new Command('init')
    .description('Create a new extension repository')
    .argument('[directory]', 'Repository directory')
    .addOption(
      new Option('--provider <provider>', 'Release provider').choices([
        ...EXTENSION_PUBLISH_PROVIDERS
      ])
    )
    .option('--registry-id <id>', 'Extension registry identifier')
    .option('--registry-name <name>', 'Extension registry name')
    .option('--registry-description <text>', 'Extension registry description')
    .option('--no-git', 'Do not initialize a Git repository')
    .option('--extension-id <id>', 'Stable extension identifier')
    .option('--extension-name <name>', 'Extension name')
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
    .action((directory: string | undefined, options: InitCommandOptions) =>
      runInit(directory, normalizeWebviewAddons(options), context)
    )
}

interface InitCommandOptions extends InitOptions {
  webviewAddon?: string[]
}

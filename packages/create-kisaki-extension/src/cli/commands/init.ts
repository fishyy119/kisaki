import { Command, Option } from 'commander'
import {
  EXTENSION_PUBLISH_WORKFLOWS,
  EXTENSION_STARTERS,
  EXTENSION_WEBVIEWS
} from '../../extension-options'
import { runInit, type InitOptions } from '../actions/init'
import type { ScaffoldCliContext } from '../context'

/** Creates the command that initializes a new extension repository. */
export function createInitCommand(context: ScaffoldCliContext): Command {
  return new Command('init')
    .description('Create a new extension repository')
    .argument('[directory]', 'Repository directory')
    .addOption(
      new Option('--publish <workflow>', 'Repository layout and publishing workflow').choices([
        ...EXTENSION_PUBLISH_WORKFLOWS
      ])
    )
    .option('--registry-id <id>', 'Extension registry identifier')
    .option('--registry-name <name>', 'Extension registry display name')
    .option('--no-git', 'Do not initialize a Git repository')
    .option('--extension-id <id>', 'Stable extension identifier')
    .option('--package-name <name>', 'Private workspace package name')
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
    .action((directory: string | undefined, options: InitOptions) =>
      runInit(directory, options, context)
    )
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

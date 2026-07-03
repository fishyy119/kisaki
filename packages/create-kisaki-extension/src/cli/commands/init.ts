import { Command, Option } from 'commander'
import { EXTENSION_PUBLISH_PROVIDERS } from '../../extension-options'
import { runInit, type InitOptions } from '../actions/init'
import type { ScaffoldCliContext } from '../context'

/** Creates the command that initializes a new extension repository. */
export function createInitCommand(context: ScaffoldCliContext): Command {
  return new Command('init')
    .description('Create a new extension repository')
    .argument('[directory]', 'Repository directory')
    .addOption(
      new Option('--publish-provider <publish-provider>', 'Publish provider').choices([
        ...EXTENSION_PUBLISH_PROVIDERS
      ])
    )
    .option('--registry-id <id>', 'Extension registry identifier')
    .option('--registry-name <name>', 'Extension registry name')
    .option('--registry-description <text>', 'Extension registry description')
    .option('--no-git', 'Do not initialize a Git repository')
    .option('--no-install', 'Do not install dependencies')
    .option('--commit', 'Commit generated files after successful installation', false)
    .option('-y, --yes', 'Use defaults for omitted values', false)
    .action((directory: string | undefined, options: InitOptions) =>
      runInit(directory, options, context)
    )
}

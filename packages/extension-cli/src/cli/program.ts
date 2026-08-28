import { Command } from 'commander'
import { createBuildCommand } from './commands/build'
import { createDevCommand } from './commands/dev'
import { createKeyCommand } from './commands/key'
import { createPackCommand } from './commands/pack'
import { createRegistryCommand } from './commands/registry'
import { createValidateCommand } from './commands/validate'

/** Version metadata displayed by the kisx CLI. */
export interface RunCliOptions {
  version: string
}

/**
 * Runs the kisx command line interface.
 */
export async function runCli(argv = process.argv, options: RunCliOptions): Promise<void> {
  const program = new Command()

  program
    .name('kisx')
    .description('CLI tools for Kisaki extension development')
    .version(options.version)
    .option('-p, --project <dir>', 'Extension project directory')
    .addCommand(createBuildCommand())
    .addCommand(createValidateCommand())
    .addCommand(createPackCommand())
    .addCommand(createKeyCommand())
    .addCommand(createRegistryCommand())
    .addCommand(createDevCommand())

  if (argv.length <= 2) {
    program.outputHelp()
    return
  }

  await program.parseAsync(argv)
}

import { Command } from 'commander'
import type { ScaffoldCliContext } from './context'
import { createAddCommand } from './commands/add'
import { createInitCommand } from './commands/init'

/** Runs the create-kisaki-extension command line interface. */
export async function runCreateExtensionCli(
  argv: readonly string[],
  context: ScaffoldCliContext
): Promise<void> {
  const program = new Command()
    .name('create-kisaki-extension')
    .description('Create and extend Kisaki extension repositories')
    .version(context.toolingVersion)
    .showHelpAfterError()
    .addCommand(createInitCommand(context))
    .addCommand(createAddCommand(context))

  if (argv.length <= 2) {
    program.outputHelp()
    return
  }

  await program.parseAsync([...argv])
}

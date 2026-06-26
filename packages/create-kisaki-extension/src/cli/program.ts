import { Command } from 'commander'
import { matchesExtensionWorkspace } from '../scaffold'
import type { ScaffoldCliContext } from './context'
import { createAddCommand } from './commands/add'
import { createInitCommand } from './commands/init'
import { cliOutput } from './tui/output'

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

  const routedArgv = routeImplicitCommand([...argv])
  await program.parseAsync(routedArgv)
}

function routeImplicitCommand(argv: string[]): string[] {
  const args = argv.slice(2)
  if (shouldLetRootCommandHandle(args)) {
    return argv
  }

  const command = matchesExtensionWorkspace(process.cwd()) ? 'add' : 'init'
  if (command === 'add') {
    cliOutput.detail(`Detected Kisaki extension workspace: ${process.cwd()}`)
    cliOutput.detail('Adding a new extension.')
  }
  return [argv[0] ?? 'node', argv[1] ?? 'create-kisaki-extension', command, ...args]
}

function shouldLetRootCommandHandle(args: readonly string[]): boolean {
  const first = args[0]
  if (first === undefined) {
    return false
  }
  if (first === 'init' || first === 'add' || first === 'help') {
    return true
  }
  return (
    args.length === 1 &&
    (first === '-h' || first === '--help' || first === '-V' || first === '--version')
  )
}

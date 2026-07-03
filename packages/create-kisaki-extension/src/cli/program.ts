import { existsSync } from 'node:fs'
import path from 'node:path'
import { Command } from 'commander'
import { ScaffoldCliError } from '../errors'
import { readExtensionWorkspace } from '../scaffold'
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

  const command = resolveImplicitCommand(process.cwd())
  if (command === 'add') {
    cliOutput.detail(`Detected Kisaki extension workspace: ${process.cwd()}`)
    cliOutput.detail('Adding a new extension.')
  }
  return [argv[0] ?? 'node', argv[1] ?? 'create-kisaki-extension', command, ...args]
}

function resolveImplicitCommand(cwd: string): 'add' | 'init' {
  try {
    readExtensionWorkspace(cwd)
    return 'add'
  } catch (error) {
    if (!matchesWorkspaceBoundary(cwd)) {
      return 'init'
    }

    const detail = error instanceof Error ? error.message : String(error)
    throw new ScaffoldCliError(
      `Current directory looks like a Kisaki extension workspace but is invalid: ${detail}`
    )
  }
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

function matchesWorkspaceBoundary(cwd: string): boolean {
  return [
    'kisaki-extension-workspace.json',
    path.join('registry', 'manifest.json'),
    path.join('extensions')
  ].some((relativePath) => existsSync(path.join(cwd, relativePath)))
}

import { Command } from 'commander'
import { buildCommand } from './commands/build'
import { devCommand } from './commands/dev'
import { outputCommand } from './commands/output'
import { packCommand } from './commands/pack'
import { validateCommand } from './commands/validate'

/**
 * Runs the kisx command line interface.
 */
export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command()

  program.name('kisx').description('CLI tools for Kisaki extension development').version('0.0.1')

  program
    .command('build')
    .description('Build the current extension with tsdown')
    .action(buildCommand)

  program
    .command('output')
    .alias('dev-output')
    .description('Build an unpacked extension package directory')
    .option('-p, --project <dir>', 'Extension project directory')
    .option(
      '-o, --out-dir <dir>',
      'Directory that will contain the extension package',
      'out/extensions'
    )
    .option('-w, --watch', 'Watch-build and keep the package output synchronized', false)
    .action(outputCommand)

  program
    .command('validate')
    .description('Validate manifest and project structure')
    .action(validateCommand)

  program
    .command('pack')
    .description('Build and package the current extension into a .kisx archive')
    .option('-o, --out-dir <dir>', 'Directory for the generated .kisx archive', '.')
    .option('--no-build', 'Skip the build step before packaging')
    .action(packCommand)

  program
    .command('dev')
    .description('Watch-build the extension and launch Kisaki with --dev-extension')
    .option('--kisaki <command>', 'Kisaki executable to launch', 'kisaki')
    .option(
      '-o, --out-dir <dir>',
      'Directory for development package output',
      '.kisaki/dev/extensions'
    )
    .action(devCommand)

  if (argv.length <= 2) {
    program.outputHelp()
    return
  }

  await program.parseAsync(argv)
}

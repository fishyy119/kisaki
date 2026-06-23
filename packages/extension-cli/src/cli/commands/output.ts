import { Command } from 'commander'
import { runOutput, type OutputOptions } from '../actions/output'
import { withProjectOption } from '../options'

/** Creates the built-in extension output command. */
export function createOutputCommand(): Command {
  return new Command('output')
    .description('Build a flat, unpacked extension package directory')
    .option(
      '-o, --out-dir <dir>',
      'Directory that will contain the extension package',
      'out/extensions'
    )
    .action((options: OutputOptions, command: Command) =>
      runOutput(withProjectOption(options, command))
    )
}

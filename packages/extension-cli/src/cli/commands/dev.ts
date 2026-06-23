import { Command } from 'commander'
import { runDev, type DevOptions } from '../actions/dev'
import { withProjectOption } from '../options'

/** Creates the extension development command. */
export function createDevCommand(): Command {
  return new Command('dev')
    .description('Watch-build the extension and launch Kisaki with it loaded from source')
    .option('--kisaki <command>', 'Kisaki executable to launch', 'kisaki')
    .option('--inspect-extension-host [address]', 'Enable extension host inspector')
    .option(
      '--inspect-brk-extension-host [address]',
      'Enable extension host inspector and break on start'
    )
    .action((options: DevOptions, command: Command) => runDev(withProjectOption(options, command)))
}

import { Command } from 'commander'
import { runUiDevServer, type UiDevServerOptions } from '../actions/ui-dev-server'
import { withProjectOption } from '../options'

/** Creates the internal webview UI development server command. */
export function createUiDevServerCommand(): Command {
  return new Command('ui-dev-server')
    .description('Serve extension webview UI with Vite HMR')
    .action((options: UiDevServerOptions, command: Command) =>
      runUiDevServer(withProjectOption(options, command))
    )
}

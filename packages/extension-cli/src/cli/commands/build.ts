import { Command } from 'commander'
import { runBuild, type BuildOptions } from '../actions/build'
import { withProjectOption } from '../options'

/** Creates the extension build command. */
export function createBuildCommand(): Command {
  return new Command('build')
    .description('Build the current extension with Vite')
    .option('-w, --watch', 'Watch sources and rebuild on changes', false)
    .option('--host-only', 'Build only the extension host bundle', false)
    .action((options: BuildOptions, command: Command) =>
      runBuild(withProjectOption(options, command))
    )
}

import { Command } from 'commander'
import { runValidate, type ValidateOptions } from '../actions/validate'
import { withProjectOption } from '../options'

/** Creates the extension project validation command. */
export function createValidateCommand(): Command {
  return new Command('validate')
    .description('Validate manifest and project structure')
    .action((options: ValidateOptions, command: Command) =>
      runValidate(withProjectOption(options, command))
    )
}

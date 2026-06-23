import { Command } from 'commander'
import { runPack, type PackOptions } from '../actions/pack'
import { withProjectOption } from '../options'

/** Creates the extension packaging command. */
export function createPackCommand(): Command {
  return new Command('pack')
    .description('Build and package the current extension into a .kisx archive')
    .option('-o, --out-dir <dir>', 'Directory for generated .kisx and .sig files', 'artifacts')
    .option('--no-build', 'Skip the build step before packaging')
    .option('--sign', 'Write an artifact signature file after packaging', false)
    .option('--key <key-file>', 'Signing key file from kisx key generate')
    .option('--target <target>', 'Artifact target for the signature payload', 'any')
    .option('--signature-out <sig-file>', 'Signature file path')
    .action((options: PackOptions, command: Command) =>
      runPack(withProjectOption(options, command))
    )
}

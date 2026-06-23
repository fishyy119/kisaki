import { Command } from 'commander'
import { runGenerateKey } from '../actions/key'

/** Creates the signing-key command group. */
export function createKeyCommand(): Command {
  const command = new Command('key').description('Manage extension signing keys')

  command
    .command('generate')
    .description('Generate an Ed25519 extension signing key file')
    .requiredOption('--out <key-file>', 'Signing key file to create')
    .option('--id <key-id>', 'Signing key id to write into registry manifests')
    .option('--force', 'Overwrite an existing key file', false)
    .action(runGenerateKey)

  return command
}

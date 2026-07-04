import { Command } from 'commander'
import { runAddRelease } from '../actions/registry/add-release'
import { runDigest } from '../actions/registry/digest'
import { runInit } from '../actions/registry/init'
import { runSign } from '../actions/registry/sign'
import { runUnyank } from '../actions/registry/unyank'
import { runValidate } from '../actions/registry/validate'
import { runYank } from '../actions/registry/yank'

/** Creates the extension registry command group. */
export function createRegistryCommand(): Command {
  const command = new Command('registry').description('Manage extension registry manifests')

  command
    .command('init')
    .description('Create an empty extension registry manifest')
    .option('--out <manifest>', 'Registry manifest path', 'registry/manifest.json')
    .option('--id <id>', 'Registry id', 'local.extensions')
    .option('--name <name>', 'Registry display name', 'Local Extensions')
    .option('--description <text>', 'Registry description')
    .option('--homepage <url>', 'Registry homepage URL')
    .option('--force', 'Overwrite an existing registry manifest', false)
    .action(runInit)

  command
    .command('validate')
    .description('Validate an extension registry manifest')
    .argument('<manifest>', 'Registry manifest path')
    .option(
      '--allow-insecure-local-urls',
      'Allow file: and localhost URLs for local testing',
      false
    )
    .action(runValidate)

  command
    .command('add-release')
    .description('Add a .kisx artifact release to a registry manifest')
    .argument('<package>', '.kisx package path')
    .requiredOption('--manifest <manifest>', 'Registry manifest path')
    .requiredOption('--url <artifact-url>', 'Published artifact URL')
    .option('--signature <sig-file>', 'Artifact signature JSON file from kisx pack --sign')
    .option('--target <target>', 'Artifact target', 'any')
    .option('--published-at <iso-date>', 'Release publication timestamp')
    .option('--release-page <url>', 'Release page URL')
    .option(
      '--changelogs <dir>',
      'Release changelog directory containing <locale>.md files with summary front matter'
    )
    .option('--default-locale <locale>', 'Default locale for --changelogs')
    .option(
      '--replace',
      'Replace an existing artifact with the same package version and target',
      false
    )
    .option(
      '--allow-insecure-local-urls',
      'Allow file: and localhost URLs for local testing',
      false
    )
    .action(runAddRelease)

  command
    .command('digest')
    .description('Print size and sha256 digest for a .kisx package')
    .argument('<package>', '.kisx package path')
    .action(runDigest)

  command
    .command('yank')
    .description('Withdraw a registry release without deleting it')
    .argument('<release>', '<extension-id>@<version>')
    .requiredOption('--manifest <manifest>', 'Registry manifest path')
    .option('--reason <text>', 'Reason shown to repository maintainers')
    .option(
      '--allow-insecure-local-urls',
      'Allow file: and localhost URLs for local testing',
      false
    )
    .action(runYank)

  command
    .command('unyank')
    .description('Restore a previously withdrawn registry release')
    .argument('<release>', '<extension-id>@<version>')
    .requiredOption('--manifest <manifest>', 'Registry manifest path')
    .option(
      '--allow-insecure-local-urls',
      'Allow file: and localhost URLs for local testing',
      false
    )
    .action(runUnyank)

  command
    .command('sign')
    .description('Sign an existing .kisx artifact identity envelope')
    .argument('<package>', '.kisx package path')
    .requiredOption('--key <key-file>', 'Signing key file from kisx key generate')
    .option('--out <sig-file>', 'Signature file path')
    .option('--target <target>', 'Artifact target', 'any')
    .action(runSign)

  return command
}

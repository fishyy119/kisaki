import { Command } from 'commander'
import { buildCommand } from './commands/build'
import { devCommand } from './commands/dev'
import { keyGenerateCommand } from './commands/key'
import { outputCommand } from './commands/output'
import { packCommand } from './commands/pack'
import {
  DEFAULT_REGISTRY_MANIFEST_PATH,
  registryAddReleaseCommand,
  registryDigestCommand,
  registryInitCommand,
  registrySignCommand,
  registryValidateCommand
} from './commands/registry'
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
    .option('--debug-sources', 'Rewrite copied source maps to workspace source paths', false)
    .option('-w, --watch', 'Watch-build and keep the package output synchronized', false)
    .action(outputCommand)

  program
    .command('validate')
    .description('Validate manifest and project structure')
    .action(validateCommand)

  program
    .command('pack')
    .description('Build and package the current extension into a .kisx archive')
    .option('-o, --out-dir <dir>', 'Directory for generated .kisx and .sig files', 'artifacts')
    .option('--no-build', 'Skip the build step before packaging')
    .option('--sign', 'Write an artifact signature file after packaging', false)
    .option('--key <key-file>', 'Signing key file from kisx key generate')
    .option('--target <target>', 'Artifact target for the signature payload', 'any')
    .option('--signature-out <sig-file>', 'Signature file path')
    .action(packCommand)

  const key = program.command('key').description('Manage extension signing keys')

  key
    .command('generate')
    .description('Generate an Ed25519 extension signing key file')
    .requiredOption('--out <key-file>', 'Signing key file to create')
    .option('--id <key-id>', 'Signing key id to write into registry manifests')
    .option('--force', 'Overwrite an existing key file', false)
    .action(keyGenerateCommand)

  const registry = program.command('registry').description('Manage extension registry manifests')

  registry
    .command('init')
    .description('Create an empty extension registry manifest')
    .option('--out <manifest>', 'Registry manifest path', DEFAULT_REGISTRY_MANIFEST_PATH)
    .option('--id <id>', 'Registry id', 'local.extensions')
    .option('--name <name>', 'Registry display name', 'Local Extensions')
    .option('--description <text>', 'Registry description')
    .option('--homepage <url>', 'Registry homepage URL')
    .option('--force', 'Overwrite an existing registry manifest', false)
    .action(registryInitCommand)

  registry
    .command('validate')
    .description('Validate an extension registry manifest')
    .argument('<manifest>', 'Registry manifest path')
    .option(
      '--allow-insecure-local-urls',
      'Allow file: and localhost URLs for local testing',
      false
    )
    .action(registryValidateCommand)

  registry
    .command('add-release')
    .description('Add a .kisx artifact release to a registry manifest')
    .argument('<package>', '.kisx package path')
    .requiredOption('--manifest <manifest>', 'Registry manifest path')
    .requiredOption('--url <artifact-url>', 'Published artifact URL')
    .option('--signature <sig-file>', 'Artifact signature JSON file from kisx pack --sign')
    .option('--target <target>', 'Artifact target', 'any')
    .option('--published-at <iso-date>', 'Release publication timestamp')
    .option('--changelog <text>', 'Release changelog text')
    .option('--changelog-url <url>', 'Release changelog URL')
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
    .action(registryAddReleaseCommand)

  registry
    .command('digest')
    .description('Print size and sha256 digest for a .kisx package')
    .argument('<package>', '.kisx package path')
    .action(registryDigestCommand)

  registry
    .command('sign')
    .description('Sign an existing .kisx artifact identity envelope')
    .argument('<package>', '.kisx package path')
    .requiredOption('--key <key-file>', 'Signing key file from kisx key generate')
    .option('--out <sig-file>', 'Signature file path')
    .option('--target <target>', 'Artifact target', 'any')
    .action(registrySignCommand)

  program
    .command('dev')
    .description('Watch-build the extension and launch Kisaki with --dev-extension')
    .option('--kisaki <command>', 'Kisaki executable to launch', 'kisaki')
    .option(
      '-o, --out-dir <dir>',
      'Directory for development package output',
      '.kisaki/dev/extensions'
    )
    .option('--inspect-extension-host [address]', 'Enable extension host inspector')
    .option(
      '--inspect-brk-extension-host [address]',
      'Enable extension host inspector and break on start'
    )
    .action(devCommand)

  if (argv.length <= 2) {
    program.outputHelp()
    return
  }

  await program.parseAsync(argv)
}

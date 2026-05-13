import { CliError, logger } from '../logger'
import { generateSigningKeyFile } from '../signing'

export interface KeyGenerateCommandOptions {
  out?: string
  id?: string
  force?: boolean
}

export async function keyGenerateCommand(options: KeyGenerateCommandOptions): Promise<void> {
  if (!options.out) {
    throw new CliError('Missing --out <key-file>.')
  }

  logger.heading('kisx key generate', 'Generating extension signing key.')
  const result = await generateSigningKeyFile({
    outFile: options.out,
    keyId: options.id,
    force: options.force
  })

  logger.success(`Created ${result.keyFilePath}`)
  logger.detail(`Key id: ${result.key.id}`)
  logger.detail(`Fingerprint: ${result.key.fingerprint}`)
}

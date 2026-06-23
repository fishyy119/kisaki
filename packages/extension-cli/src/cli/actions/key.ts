import { logger } from '../../logger'
import { generateSigningKeyFile } from '../../packaging'

/** Input accepted by the signing-key generation action. */
export interface GenerateKeyOptions {
  out: string
  id?: string
  force?: boolean
}

/** Generates an extension signing key. */
export async function runGenerateKey(options: GenerateKeyOptions): Promise<void> {
  logger.heading('kisx key generate', 'Generating extension signing key.')
  const result = await generateSigningKeyFile({
    outFile: options.out,
    ...(options.id === undefined ? {} : { keyId: options.id }),
    ...(options.force === undefined ? {} : { force: options.force })
  })

  logger.success(`Created ${result.keyFilePath}`)
  logger.detail(`Key id: ${result.key.id}`)
  logger.detail(`Fingerprint: ${result.key.fingerprint}`)
}

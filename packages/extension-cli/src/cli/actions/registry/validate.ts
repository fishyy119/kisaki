import { logger } from '../../../logger'
import { readRegistryManifestFile } from '../../../registry/document'
import { countSignedArtifacts } from '../../../registry/normalization'

/** Input accepted by the registry validation action. */
export interface ValidateOptions {
  allowInsecureLocalUrls?: boolean
}

/** Validates a registry manifest and its artifact signatures. */
export async function runValidate(manifestPath: string, options: ValidateOptions): Promise<void> {
  logger.heading('kisx registry validate', 'Validating registry manifest.')
  const manifest = await readRegistryManifestFile(manifestPath, options)
  logger.success('Registry manifest is valid.')
  logger.detail(`Packages: ${manifest.packages.length}`)
  logger.detail(`Signing keys: ${manifest.signingKeys.length}`)
  logger.detail(`Signed artifacts: ${countSignedArtifacts(manifest)}`)
}

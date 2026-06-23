import type { ExtensionRegistryArtifactTarget } from '@kisaki3/extension-registry'
import { logger } from '../../../logger'
import { inspectKisxPackage, signKisxArtifact } from '../../../packaging'

/** Input accepted by the artifact signing action. */
export interface SignOptions {
  key: string
  out?: string
  target: ExtensionRegistryArtifactTarget
}

/** Signs the canonical identity envelope for an existing package. */
export async function runSign(packagePath: string, options: SignOptions): Promise<void> {
  logger.heading('kisx registry sign', 'Signing package artifact identity.')
  const packageInfo = await inspectKisxPackage(packagePath)
  const result = await signKisxArtifact({
    archivePath: packageInfo.archivePath,
    manifest: packageInfo.manifest,
    size: packageInfo.size,
    sha256: packageInfo.sha256,
    keyPath: options.key,
    target: options.target,
    ...(options.out === undefined ? {} : { outFile: options.out })
  })
  logger.success(`Created ${result.signatureFilePath}`)
  logger.detail(`Key id: ${result.signatureFile.keyId}`)
  logger.detail(`Fingerprint: ${result.signatureFile.fingerprint}`)
}

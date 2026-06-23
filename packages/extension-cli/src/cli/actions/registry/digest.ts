import { logger } from '../../../logger'
import { inspectKisxPackage } from '../../../packaging'

/** Prints the identity and digest of a packaged extension. */
export async function runDigest(packagePath: string): Promise<void> {
  logger.heading('kisx registry digest', 'Calculating package digest.')
  const packageInfo = await inspectKisxPackage(packagePath)
  logger.success(`${packageInfo.manifest.id}@${packageInfo.manifest.version}`)
  logger.detail(`Package: ${packageInfo.archivePath}`)
  logger.detail(`Size: ${packageInfo.size}`)
  logger.detail(`sha256: ${packageInfo.sha256}`)
}

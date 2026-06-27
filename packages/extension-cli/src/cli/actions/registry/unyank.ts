import { logger } from '../../../logger'
import { readRegistryManifestFile, writeJsonDocument } from '../../../registry/document'
import { assertValidRegistryManifest } from '../../../registry/manifest'
import { parseRegistryReleaseReference } from '../../../registry/release-reference'
import { unyankRegistryRelease } from '../../../registry/yank'

/** Input accepted by the registry unyank action. */
export interface UnyankOptions {
  manifest: string
  allowInsecureLocalUrls?: boolean
}

/** Removes the withdrawn marker from one registry release. */
export async function runUnyank(releaseReference: string, options: UnyankOptions): Promise<void> {
  logger.heading('kisx registry unyank', 'Restoring registry release availability.')
  const release = parseRegistryReleaseReference(releaseReference)
  const manifest = await readRegistryManifestFile(options.manifest, {
    ...(options.allowInsecureLocalUrls === undefined
      ? {}
      : { allowInsecureLocalUrls: options.allowInsecureLocalUrls })
  })
  const result = unyankRegistryRelease({
    manifest,
    packageId: release.packageId,
    version: release.version
  })

  if (!result.changed) {
    logger.success(`Release ${release.packageId}@${release.version} is not yanked.`)
    return
  }

  await writeJsonDocument(options.manifest, assertValidRegistryManifest(result.manifest), {
    mode: 'replace'
  })
  logger.success(`Unyanked ${release.packageId}@${release.version}.`)
}

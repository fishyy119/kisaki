import { logger } from '../../../logger'
import { readRegistryManifestFile, writeJsonDocument } from '../../../registry/document'
import { assertValidRegistryManifest } from '../../../registry/manifest'
import { parseRegistryReleaseReference } from '../../../registry/release-reference'
import { yankRegistryRelease } from '../../../registry/yank'

/** Input accepted by the registry yank action. */
export interface YankOptions {
  manifest: string
  reason?: string
  allowInsecureLocalUrls?: boolean
}

/** Marks one registry release as withdrawn without deleting release history. */
export async function runYank(releaseReference: string, options: YankOptions): Promise<void> {
  logger.heading('kisx registry yank', 'Marking registry release as withdrawn.')
  const release = parseRegistryReleaseReference(releaseReference)
  const manifest = await readRegistryManifestFile(options.manifest, {
    ...(options.allowInsecureLocalUrls === undefined
      ? {}
      : { allowInsecureLocalUrls: options.allowInsecureLocalUrls })
  })
  const result = yankRegistryRelease({
    manifest,
    packageId: release.packageId,
    version: release.version,
    ...(options.reason === undefined ? {} : { reason: options.reason })
  })

  if (!result.changed) {
    logger.success(`Release ${release.packageId}@${release.version} is already yanked.`)
    return
  }

  await writeJsonDocument(options.manifest, assertValidRegistryManifest(result.manifest), {
    mode: 'replace'
  })
  logger.success(`Yanked ${release.packageId}@${release.version}.`)
}

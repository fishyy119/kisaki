import type { ExtensionRegistryArtifactTarget } from '@kisaki3/extension-registry'
import { logger } from '../../../logger'
import { publishRegistryRelease } from '../../../registry/publisher'

/** Input accepted by the registry release action. */
export interface AddReleaseOptions {
  manifest: string
  url: string
  signature?: string
  target: ExtensionRegistryArtifactTarget
  publishedAt?: string
  changelog?: string
  changelogUrl?: string
  replace?: boolean
  allowInsecureLocalUrls?: boolean
}

/** Adds or replaces one packaged release in a registry manifest. */
export async function runAddRelease(
  packagePath: string,
  options: AddReleaseOptions
): Promise<void> {
  logger.heading('kisx registry add-release', 'Updating registry manifest.')
  const result = await publishRegistryRelease({
    packagePath,
    manifestPath: options.manifest,
    artifactUrl: options.url,
    ...(options.signature === undefined ? {} : { signaturePath: options.signature }),
    target: options.target,
    ...(options.publishedAt === undefined ? {} : { publishedAt: options.publishedAt }),
    ...(options.changelog === undefined ? {} : { changelog: options.changelog }),
    ...(options.changelogUrl === undefined ? {} : { changelogUrl: options.changelogUrl }),
    ...(options.replace === undefined ? {} : { replace: options.replace }),
    ...(options.allowInsecureLocalUrls === undefined
      ? {}
      : { allowInsecureLocalUrls: options.allowInsecureLocalUrls })
  })
  logger.success(
    `Added ${result.extensionId}@${result.version} (${result.target}) to ${result.manifestPath}`
  )
  logger.detail(`Artifact size: ${result.size}`)
  logger.detail(`Artifact sha256: ${result.sha256}`)
  logger.detail(`Release digest: ${result.releaseDigest}`)
  if (result.signingKeyFingerprint) {
    logger.detail(`Verified signature fingerprint: ${result.signingKeyFingerprint}`)
  }
  if (result.signingKeyId) {
    logger.detail(`Signing key: ${result.signingKeyId}`)
  }
}

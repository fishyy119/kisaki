import type {
  ExtensionRegistryArtifactTarget,
  ExtensionRegistryLocalizedDocumentSet
} from '@kisaki3/extension-registry'
import { CliError } from '../../../errors'
import { logger } from '../../../logger'
import { readRegistryReleaseChangelogDirectory } from '../../../registry/changelog'
import { publishRegistryRelease } from '../../../registry/publisher'

/** Input accepted by the registry release action. */
export interface AddReleaseOptions {
  manifest: string
  url: string
  signature?: string
  target: ExtensionRegistryArtifactTarget
  publishedAt?: string
  releasePage?: string
  changelogs?: string
  defaultLocale?: string
  replace?: boolean
  allowInsecureLocalUrls?: boolean
}

/** Adds or replaces one packaged release in a registry manifest. */
export async function runAddRelease(
  packagePath: string,
  options: AddReleaseOptions
): Promise<void> {
  logger.heading('kisx registry add-release', 'Updating registry manifest.')
  const changelog = createChangelog(options)
  const result = await publishRegistryRelease({
    packagePath,
    manifestPath: options.manifest,
    artifactUrl: options.url,
    ...(options.signature === undefined ? {} : { signaturePath: options.signature }),
    target: options.target,
    ...(options.publishedAt === undefined ? {} : { publishedAt: options.publishedAt }),
    ...(options.releasePage === undefined ? {} : { releasePage: options.releasePage }),
    ...(changelog === undefined ? {} : { changelog }),
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

function createChangelog(
  options: AddReleaseOptions
): ExtensionRegistryLocalizedDocumentSet | undefined {
  if (options.changelogs === undefined) {
    if (options.defaultLocale !== undefined) {
      throw new CliError('--default-locale requires --changelogs.')
    }
    return undefined
  }

  if (options.defaultLocale === undefined) {
    throw new CliError('--default-locale is required when --changelogs is provided.')
  }

  return readRegistryReleaseChangelogDirectory({
    directory: options.changelogs,
    defaultLocale: options.defaultLocale
  })
}

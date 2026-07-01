import path from 'node:path'
import type {
  ExtensionRegistryArtifactTarget,
  ExtensionRegistryLocalizedDocumentSet
} from '@kisaki3/extension-registry'
import { createExtensionRegistryReleaseDigest } from '@kisaki3/extension-registry/node'
import { inspectKisxPackage } from '../packaging'
import { readRegistryManifestFile, writeJsonDocument } from './document'
import { assertValidRegistryManifest, type RegistryManifestValidationOptions } from './manifest'
import { requireRegistryPackage, requireRegistryRelease } from './normalization'
import { createRegistryRelease, upsertRegistryRelease } from './release'
import { readVerifiedSignature } from './signature'

/** Inputs for adding one packaged artifact to a registry manifest. */
export interface PublishRegistryReleaseInput extends RegistryManifestValidationOptions {
  packagePath: string
  manifestPath: string
  artifactUrl: string
  signaturePath?: string
  target: ExtensionRegistryArtifactTarget
  publishedAt?: string
  releasePage?: string
  changelog?: ExtensionRegistryLocalizedDocumentSet
  replace?: boolean
}

/** Result details emitted after a registry release is persisted. */
export interface PublishRegistryReleaseResult {
  manifestPath: string
  extensionId: string
  version: string
  target: ExtensionRegistryArtifactTarget
  size: number
  sha256: string
  releaseDigest: string
  signingKeyId?: string
  signingKeyFingerprint?: string
}

/** Verifies, merges, validates, and persists one packaged registry release. */
export async function publishRegistryRelease(
  input: PublishRegistryReleaseInput
): Promise<PublishRegistryReleaseResult> {
  const [registryManifest, packageInfo] = await Promise.all([
    readRegistryManifestFile(input.manifestPath, input),
    inspectKisxPackage(input.packagePath)
  ])
  const verifiedSignature = await readVerifiedSignature({
    ...(input.signaturePath === undefined ? {} : { signaturePath: input.signaturePath }),
    manifest: packageInfo.manifest,
    target: input.target,
    size: packageInfo.size,
    sha256: packageInfo.sha256
  })
  const artifact = {
    target: input.target,
    url: input.artifactUrl,
    size: packageInfo.size,
    sha256: packageInfo.sha256,
    ...(verifiedSignature ? { signature: verifiedSignature.artifactSignature } : {})
  }
  const release = createRegistryRelease(packageInfo.manifest, artifact, input)
  const updatedManifest = upsertRegistryRelease({
    manifest: registryManifest,
    extensionManifest: packageInfo.manifest,
    release,
    signingKey: verifiedSignature?.signingKey ?? null,
    ...(input.replace === undefined ? {} : { replace: input.replace })
  })
  assertValidRegistryManifest(updatedManifest, input)
  const updatedPackage = requireRegistryPackage(updatedManifest, packageInfo.manifest.id)
  const updatedRelease = requireRegistryRelease(updatedPackage, packageInfo.manifest.version)
  const releaseDigest = createExtensionRegistryReleaseDigest(
    updatedManifest,
    updatedPackage,
    updatedRelease
  )
  const manifestPath = path.resolve(input.manifestPath)
  await writeJsonDocument(manifestPath, updatedManifest, { mode: 'replace' })

  return {
    manifestPath,
    extensionId: packageInfo.manifest.id,
    version: packageInfo.manifest.version,
    target: input.target,
    size: packageInfo.size,
    sha256: packageInfo.sha256,
    releaseDigest,
    ...(verifiedSignature
      ? {
          signingKeyId: verifiedSignature.signingKey.id,
          signingKeyFingerprint: verifiedSignature.fingerprint
        }
      : {})
  }
}

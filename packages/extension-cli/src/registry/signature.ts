import type { ExtensionManifest } from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifactTarget,
  ExtensionRegistryManifest,
  ExtensionRegistrySigningKey
} from '@kisaki3/extension-registry'
import { CliError } from '../errors'
import {
  readArtifactSignatureFile,
  type VerifiedArtifactSignature,
  verifyArtifactSignatureForPackage,
  verifyRegistryArtifactSignature
} from '../packaging'
import { formatValidationIssues } from '../validation'
import { compareSigningKeys } from './model'

/** Reads and verifies an optional detached artifact signature. */
export async function readVerifiedSignature(input: {
  signaturePath?: string
  manifest: ExtensionManifest
  target: ExtensionRegistryArtifactTarget
  size: number
  sha256: string
}): Promise<VerifiedArtifactSignature | null> {
  if (!input.signaturePath) {
    return null
  }

  const signatureFile = await readArtifactSignatureFile(input.signaturePath)
  const verified = verifyArtifactSignatureForPackage({
    signatureFile,
    manifest: input.manifest,
    size: input.size,
    sha256: input.sha256,
    target: input.target
  })
  return verified
}

/** Adds a signing key or verifies that an existing identity is unchanged. */
export function mergeSigningKey(
  signingKeys: readonly ExtensionRegistrySigningKey[],
  signingKey: ExtensionRegistrySigningKey
): ExtensionRegistrySigningKey[] {
  const existing = signingKeys.find((candidate) => candidate.id === signingKey.id)
  if (!existing) {
    return [...signingKeys, signingKey].toSorted(compareSigningKeys)
  }
  if (existing.algorithm !== signingKey.algorithm || existing.publicKey !== signingKey.publicKey) {
    throw new CliError(`Signing key id "${signingKey.id}" already exists with different key data.`)
  }
  return [...signingKeys].toSorted(compareSigningKeys)
}

/** Verifies every signed artifact in a registry manifest. */
export function assertRegistryArtifactSignaturesValid(manifest: ExtensionRegistryManifest): void {
  const signingKeys = new Map(manifest.signingKeys.map((key) => [key.id, key]))
  const issues: { path: string; message: string }[] = []

  for (const [packageIndex, registryPackage] of manifest.packages.entries()) {
    for (const [releaseIndex, release] of registryPackage.releases.entries()) {
      for (const [artifactIndex, artifact] of release.artifacts.entries()) {
        if (!artifact.signature) {
          continue
        }
        const signingKey = signingKeys.get(artifact.signature.keyId)
        if (!signingKey) {
          continue
        }
        try {
          verifyRegistryArtifactSignature({
            packageId: registryPackage.id,
            release,
            artifact,
            signingKey
          })
        } catch (error) {
          issues.push({
            path: `$.packages[${packageIndex}].releases[${releaseIndex}].artifacts[${artifactIndex}].signature`,
            message: error instanceof Error ? error.message : 'Artifact signature is invalid.'
          })
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new CliError(formatValidationIssues('Registry artifact signatures are invalid.', issues))
  }
}

import type { ExtensionInstallPlan } from '@shared/extension'
import type { ExtensionRepositoryInstallationSnapshot } from '@shared/extension/installation-source'
import type { ExtensionRepositoryInstallCandidate } from '../repositories'
import type { TrustExtensionSignerInput } from '../signers'

export function createRepositoryInstallationSnapshot(
  candidate: ExtensionRepositoryInstallCandidate
): ExtensionRepositoryInstallationSnapshot {
  return {
    schemaVersion: candidate.manifest.schemaVersion,
    signingKeys: candidate.manifest.signingKeys,
    package: {
      id: candidate.registryPackage.id,
      categories: candidate.registryPackage.categories
    },
    release: candidate.release
  }
}

export function createSignerTrustInputs(
  candidate: ExtensionRepositoryInstallCandidate,
  plan: ExtensionInstallPlan
): readonly TrustExtensionSignerInput[] {
  const fingerprint = plan.signer.fingerprint
  const keyId = plan.signer.keyId
  if (!fingerprint || !keyId) {
    return []
  }

  const signingKey = candidate.manifest.signingKeys.find((key) => key.id === keyId)
  if (!signingKey) {
    throw new Error(`Signing key "${keyId}" is not declared by the repository manifest.`)
  }

  return [
    {
      extensionId: candidate.registryPackage.id,
      fingerprint,
      algorithm: signingKey.algorithm,
      publicKey: signingKey.publicKey,
      label: keyId,
      trustedFromRepositoryId: candidate.repository.id,
      trustedFromRepositoryUrl: candidate.repository.url
    }
  ]
}

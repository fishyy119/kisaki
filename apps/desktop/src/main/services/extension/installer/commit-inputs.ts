import type { ExtensionReleasePlan } from '@shared/extension'
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
      name: candidate.registryPackage.name,
      description: candidate.registryPackage.description,
      categories: candidate.registryPackage.categories,
      ...(candidate.registryPackage.keywords === undefined
        ? {}
        : { keywords: candidate.registryPackage.keywords }),
      ...(candidate.registryPackage.owner === undefined
        ? {}
        : { owner: candidate.registryPackage.owner }),
      ...(candidate.registryPackage.homepage === undefined
        ? {}
        : { homepage: candidate.registryPackage.homepage }),
      ...(candidate.registryPackage.repository === undefined
        ? {}
        : { repository: candidate.registryPackage.repository }),
      ...(candidate.registryPackage.license === undefined
        ? {}
        : { license: candidate.registryPackage.license }),
      ...(candidate.registryPackage.icon === undefined
        ? {}
        : { icon: candidate.registryPackage.icon })
    },
    release: candidate.release
  }
}

export function createSignerTrustInputs(
  candidate: ExtensionRepositoryInstallCandidate,
  plan: ExtensionReleasePlan
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

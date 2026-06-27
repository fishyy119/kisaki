import type {
  ExtensionRegistryManifest,
  ExtensionRegistryReleaseYank
} from '@kisaki3/extension-registry'
import {
  requireRegistryPackage,
  requireRegistryRelease,
  sortRegistryManifest
} from './normalization'

/** Result of applying a release maintenance mutation. */
export interface RegistryReleaseYankResult {
  manifest: ExtensionRegistryManifest
  changed: boolean
}

/** Marks a registry release as withdrawn while preserving the release record. */
export function yankRegistryRelease(input: {
  manifest: ExtensionRegistryManifest
  packageId: string
  version: string
  reason?: string
  yankedAt?: string
}): RegistryReleaseYankResult {
  const registryPackage = requireRegistryPackage(input.manifest, input.packageId)
  const release = requireRegistryRelease(registryPackage, input.version)
  if (release.yanked) {
    return { manifest: input.manifest, changed: false }
  }

  const yanked: ExtensionRegistryReleaseYank = {
    at: input.yankedAt ?? new Date().toISOString(),
    ...(input.reason === undefined ? {} : { reason: input.reason })
  }
  return updateRegistryRelease({
    manifest: input.manifest,
    packageId: input.packageId,
    version: input.version,
    release: { ...release, yanked }
  })
}

/** Removes a withdrawn marker from a registry release. */
export function unyankRegistryRelease(input: {
  manifest: ExtensionRegistryManifest
  packageId: string
  version: string
}): RegistryReleaseYankResult {
  const registryPackage = requireRegistryPackage(input.manifest, input.packageId)
  const release = requireRegistryRelease(registryPackage, input.version)
  if (!release.yanked) {
    return { manifest: input.manifest, changed: false }
  }

  const { yanked: _yanked, ...unyankedRelease } = release
  return updateRegistryRelease({
    manifest: input.manifest,
    packageId: input.packageId,
    version: input.version,
    release: unyankedRelease
  })
}

function updateRegistryRelease(input: {
  manifest: ExtensionRegistryManifest
  packageId: string
  version: string
  release: ExtensionRegistryManifest['packages'][number]['releases'][number]
}): RegistryReleaseYankResult {
  const manifest = sortRegistryManifest({
    ...input.manifest,
    updatedAt: new Date().toISOString(),
    packages: input.manifest.packages.map((registryPackage) =>
      registryPackage.id === input.packageId
        ? {
            ...registryPackage,
            releases: registryPackage.releases.map((release) =>
              release.version === input.version ? input.release : release
            )
          }
        : registryPackage
    )
  })

  return { manifest, changed: true }
}

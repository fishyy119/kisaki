import type {
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease
} from '@kisaki3/extension-registry'
import { CliError } from '../errors'
import {
  compareRegistryArtifacts,
  compareRegistryPackages,
  compareRegistryReleases,
  compareSigningKeys
} from './model'

/** Recursively removes undefined fields from a registry package. */
export function compactRegistryPackage(registryPackage: unknown): ExtensionRegistryPackage {
  return removeUndefined(registryPackage) as ExtensionRegistryPackage
}

/** Recursively removes undefined fields from a registry release. */
export function compactRegistryRelease(release: unknown): ExtensionRegistryRelease {
  return removeUndefined(release) as ExtensionRegistryRelease
}

/** Returns a deterministically ordered registry manifest. */
export function sortRegistryManifest(
  manifest: ExtensionRegistryManifest
): ExtensionRegistryManifest {
  return {
    ...manifest,
    signingKeys: [...manifest.signingKeys].toSorted(compareSigningKeys),
    packages: manifest.packages
      .map((registryPackage) => ({
        ...registryPackage,
        releases: registryPackage.releases
          .map((release) => ({
            ...release,
            artifacts: [...release.artifacts].toSorted(compareRegistryArtifacts)
          }))
          .toSorted(compareRegistryReleases)
      }))
      .toSorted(compareRegistryPackages)
  }
}

/** Counts artifacts that carry a cryptographic signature. */
export function countSignedArtifacts(manifest: ExtensionRegistryManifest): number {
  return manifest.packages.reduce(
    (packageTotal, registryPackage) =>
      packageTotal +
      registryPackage.releases.reduce(
        (releaseTotal, release) =>
          releaseTotal + release.artifacts.filter((artifact) => artifact.signature).length,
        0
      ),
    0
  )
}

/** Returns a package that must have survived a registry update. */
export function requireRegistryPackage(
  manifest: ExtensionRegistryManifest,
  extensionId: string
): ExtensionRegistryPackage {
  const registryPackage = manifest.packages.find((candidate) => candidate.id === extensionId)
  if (!registryPackage) {
    throw new CliError(`Package "${extensionId}" was not written to the registry manifest.`)
  }
  return registryPackage
}

/** Returns a release that must have survived a registry update. */
export function requireRegistryRelease(
  registryPackage: ExtensionRegistryPackage,
  version: string
): ExtensionRegistryRelease {
  const release = registryPackage.releases.find((candidate) => candidate.version === version)
  if (!release) {
    throw new CliError(
      `Release "${registryPackage.id}@${version}" was not written to the registry manifest.`
    )
  }
  return release
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefined)
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, removeUndefined(entry)])
  )
}

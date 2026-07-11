import semver from 'semver'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease,
  ExtensionRegistrySigningKey
} from '@kisaki3/extension-registry'

/** Creates the short registry summary for an extension package. */
export function createPackageSummary(manifest: ExtensionManifest): string {
  const description = manifest.description?.trim()
  if (!description) {
    return manifest.name
  }
  return description.length > 160 ? `${description.slice(0, 157)}...` : description
}

/** Compares registry packages by stable identifier. */
export function compareRegistryPackages(
  left: ExtensionRegistryPackage,
  right: ExtensionRegistryPackage
): number {
  return compareStrings(left.id, right.id)
}

/** Orders releases by descending semantic version. */
export function compareRegistryReleases(
  left: ExtensionRegistryRelease,
  right: ExtensionRegistryRelease
): number {
  return semver.rcompare(left.version, right.version) || compareStrings(left.version, right.version)
}

/** Compares artifacts deterministically by target and digest. */
export function compareRegistryArtifacts(
  left: ExtensionRegistryArtifact,
  right: ExtensionRegistryArtifact
): number {
  return compareStrings(left.target, right.target) || compareStrings(left.sha256, right.sha256)
}

/** Compares signing keys by stable identifier. */
export function compareSigningKeys(
  left: ExtensionRegistrySigningKey,
  right: ExtensionRegistrySigningKey
): number {
  return compareStrings(left.id, right.id)
}

/** Tests category equality without depending on ordering or duplicates. */
export function areCategorySetsEqual(left: readonly string[], right: readonly string[]): boolean {
  return [...new Set(left)].toSorted().join('\0') === [...new Set(right)].toSorted().join('\0')
}

/** Tests whether two registry artifacts describe the same published file. */
export function areRegistryArtifactsEqual(
  left: ExtensionRegistryArtifact,
  right: ExtensionRegistryArtifact
): boolean {
  return (
    left.target === right.target &&
    left.url === right.url &&
    left.size === right.size &&
    left.sha256 === right.sha256 &&
    JSON.stringify(left.signature) === JSON.stringify(right.signature)
  )
}

/** Tests semantic registry equality while ignoring the update timestamp. */
export function areRegistryManifestsEquivalent(
  left: ExtensionRegistryManifest,
  right: ExtensionRegistryManifest,
  sort: (manifest: ExtensionRegistryManifest) => ExtensionRegistryManifest
): boolean {
  return (
    JSON.stringify(sort({ ...left, updatedAt: '' })) ===
    JSON.stringify(sort({ ...right, updatedAt: '' }))
  )
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

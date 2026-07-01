import type { ExtensionManifest } from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryLocalizedDocumentSet,
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease,
  ExtensionRegistrySigningKey
} from '@kisaki3/extension-registry'
import { CliError } from '../errors'
import {
  compactRegistryPackage,
  compactRegistryRelease,
  sortRegistryManifest
} from './normalization'
import { mergeSigningKey } from './signature'
import {
  areCategorySetsEqual,
  areRegistryArtifactsEqual,
  areRegistryManifestsEquivalent,
  compareRegistryArtifacts,
  compareRegistryReleases,
  createPackageDescription
} from './model'

/** Release metadata supplied independently from the packaged extension. */
export interface CreateRegistryReleaseOptions {
  publishedAt?: string
  releasePage?: string
  changelog?: ExtensionRegistryLocalizedDocumentSet
}

/** Builds a registry release from a validated package manifest and artifact. */
export function createRegistryRelease(
  manifest: ExtensionManifest,
  artifact: ExtensionRegistryArtifact,
  options: CreateRegistryReleaseOptions
): ExtensionRegistryRelease {
  const kisakiRange = manifest.engines.kisaki.trim()
  if (!kisakiRange) {
    throw new CliError(
      'manifest.json must include engines.kisaki Extension API range before publishing a release.'
    )
  }
  return compactRegistryRelease({
    version: manifest.version,
    publishedAt: options.publishedAt ?? new Date().toISOString(),
    engines: { kisaki: kisakiRange },
    releasePage: options.releasePage,
    changelog: options.changelog,
    artifacts: [artifact]
  })
}

/** Inserts or replaces one release while preserving registry invariants. */
export function upsertRegistryRelease(input: {
  manifest: ExtensionRegistryManifest
  extensionManifest: ExtensionManifest
  release: ExtensionRegistryRelease
  signingKey: ExtensionRegistrySigningKey | null
  replace?: boolean
}): ExtensionRegistryManifest {
  const signingKeys = input.signingKey
    ? mergeSigningKey(input.manifest.signingKeys, input.signingKey)
    : [...input.manifest.signingKeys]
  const packages = [...input.manifest.packages]
  const packageIndex = packages.findIndex((item) => item.id === input.extensionManifest.id)
  const existingPackage =
    packageIndex >= 0 ? packages[packageIndex] : createRegistryPackage(input.extensionManifest)
  const releaseIndex = existingPackage.releases.findIndex(
    (release) => release.version === input.release.version
  )

  if (!areCategorySetsEqual(existingPackage.categories, input.extensionManifest.categories)) {
    throw new CliError(
      `Existing package "${existingPackage.id}" has different categories than the .kisx manifest.`
    )
  }

  const updatedRelease =
    releaseIndex >= 0
      ? mergeRegistryRelease({
          packageId: existingPackage.id,
          existing: existingPackage.releases[releaseIndex],
          incoming: input.release,
          ...(input.replace === undefined ? {} : { replace: input.replace })
        })
      : input.release
  const releases =
    releaseIndex >= 0
      ? existingPackage.releases.map((release, index) =>
          index === releaseIndex ? updatedRelease : release
        )
      : existingPackage.releases.concat(updatedRelease)
  const updatedPackage = {
    ...existingPackage,
    releases: releases.toSorted(compareRegistryReleases)
  }
  if (packageIndex >= 0) {
    packages[packageIndex] = updatedPackage
  } else {
    packages.push(updatedPackage)
  }

  const candidate = sortRegistryManifest({
    ...input.manifest,
    signingKeys,
    packages
  })
  if (areRegistryManifestsEquivalent(input.manifest, candidate, sortRegistryManifest)) {
    return input.manifest
  }
  return { ...candidate, updatedAt: new Date().toISOString() }
}

function createRegistryPackage(manifest: ExtensionManifest): ExtensionRegistryPackage {
  return compactRegistryPackage({
    id: manifest.id,
    name: manifest.name,
    description: createPackageDescription(manifest),
    categories: manifest.categories,
    keywords: manifest.keywords,
    owner: manifest.author ? { name: manifest.author } : undefined,
    homepage: manifest.homepage,
    releases: []
  })
}

function mergeRegistryRelease(input: {
  packageId: string
  existing: ExtensionRegistryRelease
  incoming: ExtensionRegistryRelease
  replace?: boolean
}): ExtensionRegistryRelease {
  if (input.existing.engines.kisaki.trim() !== input.incoming.engines.kisaki.trim()) {
    throw new CliError(
      `${input.packageId}@${input.incoming.version} already exists with a different engines.kisaki range. Publish a new semver version.`
    )
  }

  const incomingArtifact = input.incoming.artifacts[0]
  const artifactIndex = input.existing.artifacts.findIndex(
    (artifact) => artifact.target === incomingArtifact.target
  )
  if (artifactIndex >= 0) {
    const existingArtifact = input.existing.artifacts[artifactIndex]
    const artifactChanged = !areRegistryArtifactsEqual(existingArtifact, incomingArtifact)
    const changelogChanged =
      input.incoming.changelog !== undefined &&
      JSON.stringify(input.incoming.changelog) !== JSON.stringify(input.existing.changelog)
    const releasePageChanged =
      input.incoming.releasePage !== undefined &&
      input.incoming.releasePage !== input.existing.releasePage
    if (!artifactChanged && !changelogChanged && !releasePageChanged) {
      return input.existing
    }
    if (artifactChanged && !input.replace) {
      throw new CliError(
        `${input.packageId}@${input.incoming.version} already has artifact target "${incomingArtifact.target}". Use --replace to overwrite it.`
      )
    }
  }

  const artifacts =
    artifactIndex >= 0
      ? input.existing.artifacts.map((artifact, index) =>
          index === artifactIndex ? incomingArtifact : artifact
        )
      : input.existing.artifacts.concat(incomingArtifact)
  return compactRegistryRelease({
    ...input.existing,
    publishedAt: input.replace ? input.incoming.publishedAt : input.existing.publishedAt,
    releasePage: input.incoming.releasePage ?? input.existing.releasePage,
    changelog: input.incoming.changelog ?? input.existing.changelog,
    artifacts: artifacts.toSorted(compareRegistryArtifacts)
  })
}

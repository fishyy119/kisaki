import semver from 'semver'
import {
  getExtensionRegistryReleaseKind,
  selectExtensionRegistryArtifact,
  type ExtensionRegistryManifest,
  type ExtensionRegistryRelease,
  type ExtensionRegistryReleaseKind
} from '@kisaki3/extension-registry'
import { createExtensionRegistryReleaseDigest } from '@kisaki3/extension-registry/node'
import type { ExtensionRepositoryRow } from '@shared/db'
import type { ExtensionRepositoryStore } from './store'
import type { ExtensionRepositoryInstallCandidate } from './types'
import { requireNonEmptyString } from './normalization'

export interface CollectInstallCandidatesOptions {
  repositoryId?: string
  releaseId?: string
  releaseKind?: ExtensionRegistryReleaseKind
  includeYanked?: boolean
  compatibleOnly?: boolean
}

export interface CollectInstallCandidatesDependencies {
  store: ExtensionRepositoryStore
  apiVersion: string
  getAllowedManifestSnapshot(repository: ExtensionRepositoryRow): ExtensionRegistryManifest | null
}

export interface InstallCandidateCollectionResult {
  extensionId: string
  releaseId?: string
  packageFound: boolean
  releaseFound: boolean
  candidates: ExtensionRepositoryInstallCandidate[]
}

export function collectInstallCandidates(
  extensionIdValue: string,
  options: CollectInstallCandidatesOptions,
  dependencies: CollectInstallCandidatesDependencies
): InstallCandidateCollectionResult {
  const extensionId = requireNonEmptyString(extensionIdValue, 'extension id')
  const repositoryId = options.repositoryId
    ? requireNonEmptyString(options.repositoryId, 'repository id')
    : undefined
  const releaseId = options.releaseId
    ? requireNonEmptyString(options.releaseId, 'release id')
    : undefined
  const repositories = repositoryId
    ? [dependencies.store.require(repositoryId)]
    : dependencies.store.listEnabled()
  const candidates: ExtensionRepositoryInstallCandidate[] = []
  let packageFound = false
  let releaseFound = false

  for (const repository of repositories) {
    if (repository.state !== 'enabled') {
      continue
    }

    const manifest = dependencies.getAllowedManifestSnapshot(repository)
    if (!manifest) {
      continue
    }

    const registryPackage = manifest.packages.find((item) => item.id === extensionId)
    if (!registryPackage) {
      continue
    }
    packageFound = true

    for (const release of registryPackage.releases) {
      const releaseDigest = createExtensionRegistryReleaseDigest(manifest, registryPackage, release)
      if (releaseId && releaseDigest !== releaseId) {
        continue
      }
      releaseFound = true
      if (
        options.releaseKind &&
        getExtensionRegistryReleaseKind(release.version) !== options.releaseKind
      ) {
        continue
      }
      if (
        options.compatibleOnly !== false &&
        !isReleaseCompatible(release, dependencies.apiVersion)
      ) {
        continue
      }
      if (!options.includeYanked && release.yanked !== undefined) {
        continue
      }

      const artifact = selectExtensionRegistryArtifact(release)
      if (!artifact) {
        continue
      }

      candidates.push({
        repository,
        manifest,
        registryPackage,
        release,
        releaseDigest,
        artifact
      })
    }
  }

  return {
    extensionId,
    releaseId,
    packageFound,
    releaseFound,
    candidates
  }
}

export function compareInstallCandidates(
  left: ExtensionRepositoryInstallCandidate,
  right: ExtensionRepositoryInstallCandidate,
  apiVersion: string
): number {
  return (
    compareBooleans(
      isReleaseCompatible(left.release, apiVersion),
      isReleaseCompatible(right.release, apiVersion)
    ) ||
    compareBooleans(left.release.yanked === undefined, right.release.yanked === undefined) ||
    compareBooleans(
      getExtensionRegistryReleaseKind(left.release.version) === 'stable',
      getExtensionRegistryReleaseKind(right.release.version) === 'stable'
    ) ||
    semver.rcompare(left.release.version, right.release.version) ||
    compareNullableTime(right.release.publishedAt, left.release.publishedAt) ||
    compareNumbers(left.repository.priority, right.repository.priority) ||
    compareStrings(left.repository.id, right.repository.id) ||
    compareStrings(left.releaseDigest, right.releaseDigest)
  )
}

export function isReleaseCompatible(
  release: Pick<ExtensionRegistryRelease, 'engines'>,
  apiVersion: string
): boolean {
  return semver.satisfies(apiVersion, release.engines.kisakiExtensionApi)
}

function compareBooleans(left: boolean, right: boolean): number {
  return left === right ? 0 : left ? -1 : 1
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function compareNullableTime(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : 0
  const rightTime = right ? Date.parse(right) : 0
  return compareNumbers(
    Number.isFinite(leftTime) ? leftTime : 0,
    Number.isFinite(rightTime) ? rightTime : 0
  )
}

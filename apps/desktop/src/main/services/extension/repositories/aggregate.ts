import semver from 'semver'
import {
  getExtensionRegistryReleaseKind,
  selectExtensionRegistryArtifact,
  type ExtensionRegistryArtifact,
  type ExtensionRegistryManifest,
  type ExtensionRegistryPackage,
  type ExtensionRegistryRelease
} from '@kisaki3/extension-registry'
import {
  createExtensionRegistryReleaseDigest,
  createExtensionRegistrySignerFingerprint
} from '@kisaki3/extension-registry/node'
import type {
  ExtensionCatalogArtifactInfo,
  ExtensionCatalogPackageInfo,
  ExtensionCatalogReleaseInfo,
  ExtensionCatalogSearchRequest,
  ExtensionCatalogSearchResult,
  ExtensionCatalogRepositorySourceInfo
} from '@shared/extension'
import type { ExtensionRepositoryRow } from '@shared/db'
import type {
  ExtensionRepositoryCatalog,
  ExtensionRepositoryCatalogPackage,
  ExtensionRepositorySearchContext
} from './types'

interface PackageAccumulator {
  id: string
  sources: ExtensionCatalogRepositorySourceInfo[]
  packageSources: Array<{
    repository: ExtensionRepositoryRow
    manifest: ExtensionRegistryManifest
    registryPackage: ExtensionRegistryPackage
  }>
  releasesByDigest: Map<string, ReleaseAccumulator>
}

interface ReleaseAccumulator {
  release: ExtensionCatalogReleaseInfo
  sourcesByRepositoryId: Map<string, ExtensionCatalogRepositorySourceInfo>
}

export interface ExtensionRepositoryAggregatorOptions {
  appVersion: string
  resolveIconUrl(icon: ExtensionRegistryPackage['icon'] | undefined): string | null
}

export class ExtensionRepositoryAggregator {
  constructor(private readonly options: ExtensionRepositoryAggregatorOptions) {}

  aggregate(repositories: readonly ExtensionRepositoryRow[]): ExtensionRepositoryCatalog {
    const packages = new Map<string, PackageAccumulator>()

    for (const repository of repositories) {
      const manifest = repository.manifestSnapshot
      if (!manifest) {
        continue
      }

      for (const registryPackage of manifest.packages) {
        const accumulator = getOrCreatePackageAccumulator(packages, registryPackage.id)
        const sourceInfo = toRepositorySourceInfo(repository)
        if (!accumulator.sources.some((source) => source.repositoryId === repository.id)) {
          accumulator.sources.push(sourceInfo)
        }
        accumulator.packageSources.push({
          repository,
          manifest,
          registryPackage
        })

        for (const release of registryPackage.releases) {
          const releaseDigest = createExtensionRegistryReleaseDigest(
            manifest,
            registryPackage,
            release
          )
          const releaseInfo = toReleaseInfo({
            manifest,
            repository,
            registryPackage,
            release,
            releaseDigest,
            appVersion: this.options.appVersion
          })
          const existing = accumulator.releasesByDigest.get(releaseDigest)
          if (!existing) {
            accumulator.releasesByDigest.set(releaseDigest, {
              release: releaseInfo,
              sourcesByRepositoryId: new Map([[repository.id, sourceInfo]])
            })
            continue
          }

          existing.sourcesByRepositoryId.set(repository.id, sourceInfo)
          if (compareReleaseSources(releaseInfo, existing.release) < 0) {
            existing.release = releaseInfo
          }
        }
      }
    }

    return {
      packages: [...packages.values()].map((item) => this.toCatalogPackage(item)),
      updatedAt: new Date().toISOString()
    }
  }

  search(
    catalog: ExtensionRepositoryCatalog,
    request: ExtensionCatalogSearchRequest = {},
    context: ExtensionRepositorySearchContext = {}
  ): ExtensionCatalogSearchResult {
    const query = normalizeQuery(request.query)
    const page = normalizePositiveInteger(request.page, 1)
    const limit = Math.min(normalizePositiveInteger(request.limit, 50), 200)
    const filtered = filterSearchItems(catalog, request, context, query)

    filtered.sort((left, right) => compareSearchItems(left, right, request))

    const offset = (page - 1) * limit
    const pageItems = filtered
      .slice(offset, offset + limit)
      .map(({ item }) => toPublicPackage(item))

    return {
      packages: pageItems,
      total: filtered.length,
      hasMore: offset + pageItems.length < filtered.length
    }
  }

  private toCatalogPackage(accumulator: PackageAccumulator): ExtensionRepositoryCatalogPackage {
    const packageSources = accumulator.packageSources.toSorted((left, right) =>
      compareRepositoryRows(left.repository, right.repository)
    )
    const primary = packageSources[0]
    const releases = [...accumulator.releasesByDigest.values()]
      .map(({ release, sourcesByRepositoryId }) => ({
        ...release,
        repositoryCount: sourcesByRepositoryId.size,
        sources: [...sourcesByRepositoryId.values()].toSorted(compareRepositorySources)
      }))
      .toSorted(compareReleases)
    const latestRelease = selectLatestRelease(releases)
    const updatedAt = selectPackageUpdatedAt(primary.manifest, releases)

    return {
      id: accumulator.id,
      name: primary.registryPackage.name,
      summary: primary.registryPackage.summary,
      description: primary.registryPackage.description,
      categories: primary.registryPackage.categories,
      keywords: primary.registryPackage.keywords ?? [],
      owner: primary.registryPackage.owner,
      homepage: primary.registryPackage.homepage,
      repository: primary.registryPackage.repository,
      license: primary.registryPackage.license,
      iconUrl: this.options.resolveIconUrl(primary.registryPackage.icon) ?? undefined,
      repositoryCount: accumulator.sources.length,
      latestRelease,
      releases,
      sources: accumulator.sources.toSorted(compareRepositorySources),
      updatedAt,
      remoteIcon: primary.registryPackage.icon ?? null,
      searchText: createSearchText(primary.registryPackage)
    }
  }
}

function getOrCreatePackageAccumulator(
  packages: Map<string, PackageAccumulator>,
  id: string
): PackageAccumulator {
  const existing = packages.get(id)
  if (existing) {
    return existing
  }

  const created: PackageAccumulator = {
    id,
    sources: [],
    packageSources: [],
    releasesByDigest: new Map()
  }
  packages.set(id, created)
  return created
}

function toReleaseInfo(input: {
  manifest: ExtensionRegistryManifest
  repository: ExtensionRepositoryRow
  registryPackage: ExtensionRegistryPackage
  release: ExtensionRegistryRelease
  releaseDigest: string
  appVersion: string
}): ExtensionCatalogReleaseInfo {
  const artifacts = input.release.artifacts.map((artifact) =>
    toArtifactInfo(input.manifest, artifact)
  )
  const selectedArtifact = selectExtensionRegistryArtifact(input.release)
  const source = toRepositorySourceInfo(input.repository)

  return {
    id: input.releaseDigest,
    releaseDigest: input.releaseDigest,
    version: input.release.version,
    releaseKind: getExtensionRegistryReleaseKind(input.release.version),
    publishedAt: input.release.publishedAt,
    engines: input.release.engines,
    changelog: input.release.changelog,
    yanked: input.release.yanked === true,
    compatible: semver.satisfies(input.appVersion, input.release.engines.kisaki),
    repositoryCount: 1,
    repositoryId: source.repositoryId,
    repositoryName: source.repositoryName,
    repositoryUrl: source.repositoryUrl,
    repositoryPriority: source.repositoryPriority,
    manifestDigest: source.manifestDigest,
    sources: [source],
    artifact: selectedArtifact ? toArtifactInfo(input.manifest, selectedArtifact) : null,
    artifacts
  }
}

function toArtifactInfo(
  manifest: ExtensionRegistryManifest,
  artifact: ExtensionRegistryArtifact
): ExtensionCatalogArtifactInfo {
  const signature = artifact.signature
  const signingKey = signature
    ? manifest.signingKeys.find((key) => key.id === signature.keyId)
    : undefined

  return {
    target: artifact.target,
    url: artifact.url,
    size: artifact.size,
    sha256: artifact.sha256,
    signature:
      signature && signingKey
        ? {
            keyId: signature.keyId,
            algorithm: signature.algorithm,
            fingerprint: createExtensionRegistrySignerFingerprint(signingKey.publicKey)
          }
        : null
  }
}

function toRepositorySourceInfo(
  repository: ExtensionRepositoryRow
): ExtensionCatalogRepositorySourceInfo {
  return {
    repositoryId: repository.id,
    repositoryName: repository.name,
    repositoryUrl: repository.url,
    repositoryPriority: repository.priority,
    manifestDigest: repository.manifestDigest
  }
}

function selectLatestRelease(
  releases: readonly ExtensionCatalogReleaseInfo[]
): ExtensionCatalogReleaseInfo | null {
  return (
    releases.find(
      (release) => release.compatible && !release.yanked && release.releaseKind === 'stable'
    ) ??
    releases.find((release) => release.compatible && !release.yanked) ??
    releases[0] ??
    null
  )
}

function selectPackageUpdatedAt(
  manifest: ExtensionRegistryManifest,
  releases: readonly ExtensionCatalogReleaseInfo[]
): string | null {
  const latestReleaseTime = releases.reduce((latest, release) => {
    const value = Date.parse(release.publishedAt)
    return Number.isFinite(value) ? Math.max(latest, value) : latest
  }, 0)

  if (latestReleaseTime > 0) {
    return new Date(latestReleaseTime).toISOString()
  }

  return manifest.updatedAt ?? null
}

function filterPackage(
  item: ExtensionRepositoryCatalogPackage,
  request: ExtensionCatalogSearchRequest,
  context: ExtensionRepositorySearchContext
): ExtensionRepositoryCatalogPackage | null {
  if (request.category && !item.categories.includes(request.category)) {
    return null
  }

  if (request.installedOnly && !context.installedVersions?.has(item.id)) {
    return null
  }

  const releases = item.releases.filter((release) => {
    if (
      request.repositoryId &&
      !release.sources.some((source) => source.repositoryId === request.repositoryId)
    ) {
      return false
    }
    if (request.compatibleOnly && (!release.compatible || release.yanked)) {
      return false
    }
    if (request.hasUpdateOnly) {
      const installedVersion = context.installedVersions?.get(item.id)
      if (!installedVersion || !semver.gt(release.version, installedVersion)) {
        return false
      }
    }
    return true
  })

  if (
    request.repositoryId &&
    !item.sources.some((source) => source.repositoryId === request.repositoryId)
  ) {
    return null
  }

  if (
    (request.compatibleOnly || request.repositoryId || request.hasUpdateOnly) &&
    releases.length === 0
  ) {
    return null
  }

  return {
    ...item,
    latestRelease: selectLatestRelease(releases),
    releases
  }
}

function filterSearchItems(
  catalog: ExtensionRepositoryCatalog,
  request: ExtensionCatalogSearchRequest,
  context: ExtensionRepositorySearchContext,
  query: string
): Array<{ item: ExtensionRepositoryCatalogPackage; score: number }> {
  return catalog.packages
    .map((item) => filterPackage(item, request, context))
    .filter((item): item is ExtensionRepositoryCatalogPackage => item !== null)
    .map((item) => ({
      item,
      score: query ? calculateRelevanceScore(item, query) : 0
    }))
    .filter(({ score }) => !query || score > 0)
}

function toPublicPackage(item: ExtensionRepositoryCatalogPackage): ExtensionCatalogPackageInfo {
  const { remoteIcon: _remoteIcon, searchText: _searchText, ...publicInfo } = item
  return publicInfo
}

function calculateRelevanceScore(item: ExtensionRepositoryCatalogPackage, query: string): number {
  let score = 0
  const id = item.id.toLowerCase()
  const name = item.name.toLowerCase()

  if (id === query) score += 100
  if (name === query) score += 90
  if (id.includes(query)) score += 40
  if (name.includes(query)) score += 35
  if (item.keywords.some((keyword) => keyword.toLowerCase().includes(query))) score += 20
  if (item.summary.toLowerCase().includes(query)) score += 15
  if (item.searchText.includes(query)) score += 5

  return score
}

function compareSearchItems(
  left: { item: ExtensionRepositoryCatalogPackage; score: number },
  right: { item: ExtensionRepositoryCatalogPackage; score: number },
  request: ExtensionCatalogSearchRequest
): number {
  const sortBy = request.sortBy ?? 'relevance'
  const defaultDirection = sortBy === 'name' || sortBy === 'repositoryPriority' ? 'asc' : 'desc'
  const direction = request.sortDirection ?? defaultDirection
  const multiplier = direction === 'asc' ? 1 : -1

  let result = 0
  switch (sortBy) {
    case 'name':
      result = compareStrings(left.item.name, right.item.name)
      break
    case 'updatedAt':
      result = compareNullableTime(left.item.updatedAt, right.item.updatedAt)
      break
    case 'publishedAt':
      result = compareNullableTime(
        left.item.latestRelease?.publishedAt ?? null,
        right.item.latestRelease?.publishedAt ?? null
      )
      break
    case 'repositoryPriority':
      result = compareNumbers(minRepositoryPriority(left.item), minRepositoryPriority(right.item))
      break
    case 'relevance':
      result = compareNumbers(left.score, right.score)
      if (result !== 0) {
        return result * multiplier
      }
      return (
        compareStrings(left.item.name, right.item.name) ||
        compareStrings(left.item.id, right.item.id)
      )
  }

  return result === 0 ? compareStrings(left.item.id, right.item.id) : result * multiplier
}

function compareReleases(
  left: ExtensionCatalogReleaseInfo,
  right: ExtensionCatalogReleaseInfo
): number {
  return (
    compareBooleans(left.compatible, right.compatible) ||
    compareBooleans(!left.yanked, !right.yanked) ||
    compareBooleans(left.releaseKind === 'stable', right.releaseKind === 'stable') ||
    semver.rcompare(left.version, right.version) ||
    compareNullableTime(right.publishedAt, left.publishedAt) ||
    compareReleaseSources(left, right) ||
    compareStrings(left.releaseDigest, right.releaseDigest)
  )
}

function compareReleaseSources(
  left: ExtensionCatalogReleaseInfo,
  right: ExtensionCatalogReleaseInfo
): number {
  return (
    compareNumbers(left.repositoryPriority, right.repositoryPriority) ||
    compareStrings(left.repositoryId, right.repositoryId)
  )
}

function compareRepositoryRows(
  left: ExtensionRepositoryRow,
  right: ExtensionRepositoryRow
): number {
  return compareNumbers(left.priority, right.priority) || compareStrings(left.id, right.id)
}

function compareRepositorySources(
  left: ExtensionCatalogRepositorySourceInfo,
  right: ExtensionCatalogRepositorySourceInfo
): number {
  return (
    compareNumbers(left.repositoryPriority, right.repositoryPriority) ||
    compareStrings(left.repositoryId, right.repositoryId)
  )
}

function createSearchText(registryPackage: ExtensionRegistryPackage): string {
  return [
    registryPackage.id,
    registryPackage.name,
    registryPackage.summary,
    registryPackage.description ?? '',
    ...(registryPackage.keywords ?? [])
  ]
    .join('\n')
    .toLowerCase()
}

function normalizeQuery(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback
  }

  return Number.isSafeInteger(value) && value > 0 ? value : fallback
}

function minRepositoryPriority(item: ExtensionCatalogPackageInfo): number {
  return item.sources.reduce(
    (priority, source) => Math.min(priority, source.repositoryPriority),
    Number.MAX_SAFE_INTEGER
  )
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right)
}

function compareNumbers(left: number, right: number): number {
  return left === right ? 0 : left < right ? -1 : 1
}

function compareNullableTime(left: string | null, right: string | null): number {
  const leftTime = left ? Date.parse(left) : 0
  const rightTime = right ? Date.parse(right) : 0
  return compareNumbers(
    Number.isFinite(leftTime) ? leftTime : 0,
    Number.isFinite(rightTime) ? rightTime : 0
  )
}

function compareBooleans(left: boolean, right: boolean): number {
  return left === right ? 0 : left ? -1 : 1
}

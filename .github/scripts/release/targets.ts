import { readRequiredEnv } from './common'

export type ReleaseTarget = 'desktop' | 'extension-tooling'

const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/

interface ReleaseTargetDefinition {
  readonly tagPrefix: string
  readonly releaseName: (version: string) => string
  readonly changelogTitle: (version: string) => string
  readonly includePackageSummary: boolean
  readonly makeLatest: (version: string) => boolean
}

export const releaseTargets: Record<ReleaseTarget, ReleaseTargetDefinition> = {
  desktop: {
    tagPrefix: 'desktop-v',
    releaseName: (version) => `Kisaki v${version}`,
    changelogTitle: (version) => `# Kisaki v${version}`,
    includePackageSummary: false,
    makeLatest: (version) => !isPrereleaseVersion(version)
  },
  'extension-tooling': {
    tagPrefix: 'extension-tooling-v',
    releaseName: (version) => `Kisaki Extension Tooling v${version}`,
    changelogTitle: (version) => `# Kisaki Extension Tooling v${version}`,
    includePackageSummary: true,
    makeLatest: () => false
  }
}

export function readReleaseTarget(): ReleaseTarget {
  return requireReleaseTarget(readRequiredEnv('RELEASE_TARGET'))
}

export function requireReleaseTarget(value: string): ReleaseTarget {
  if (value === 'desktop' || value === 'extension-tooling') {
    return value
  }
  throw new Error(`Unknown release target: ${value}`)
}

export function getReleaseTargetDefinition(target: ReleaseTarget): ReleaseTargetDefinition {
  return releaseTargets[target]
}

export function parseReleaseTag(tag: string): { target: ReleaseTarget; version: string } {
  for (const [target, definition] of Object.entries(releaseTargets) as Array<
    [ReleaseTarget, ReleaseTargetDefinition]
  >) {
    if (!tag.startsWith(definition.tagPrefix)) {
      continue
    }

    const version = tag.slice(definition.tagPrefix.length)
    if (!VERSION_PATTERN.test(version)) {
      throw new Error(
        `Invalid ${target} release tag "${tag}". Expected ${definition.tagPrefix}<semver>.`
      )
    }

    return { target, version }
  }

  throw new Error(
    `Unknown release tag "${tag}". Expected one of: ${Object.values(releaseTargets)
      .map((definition) => `${definition.tagPrefix}<semver>`)
      .join(', ')}.`
  )
}

export function getReleaseMetadata(
  target: ReleaseTarget,
  version: string
): {
  tagPrefix: string
  tag: string
  releaseName: string
  isPrerelease: boolean
  makeLatest: boolean
} {
  const definition = getReleaseTargetDefinition(target)
  const isPrerelease = isPrereleaseVersion(version)
  return {
    tagPrefix: definition.tagPrefix,
    tag: `${definition.tagPrefix}${version}`,
    releaseName: definition.releaseName(version),
    isPrerelease,
    makeLatest: definition.makeLatest(version)
  }
}

function isPrereleaseVersion(version: string): boolean {
  return version.includes('-')
}

import { readRequiredEnv } from './common'

export type ReleaseTarget = 'desktop' | 'extension-tooling'

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

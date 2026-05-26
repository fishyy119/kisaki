import semver, { type SemVer } from 'semver'
import { EXTENSION_API_VERSION } from './version'

export type ExtensionApiVersionStage = 'experimental' | 'alpha' | 'beta' | 'rc' | 'stable'

export type ExtensionApiDistTag = 'experimental' | 'alpha' | 'beta' | 'rc' | 'latest'

export function getExtensionApiVersionStage(
  apiVersion: string = EXTENSION_API_VERSION
): ExtensionApiVersionStage {
  const parsed = parseExtensionApiVersion(apiVersion)

  if (parsed.major === 0) {
    return 'experimental'
  }

  const prereleaseStage = parsed.prerelease[0]
  if (prereleaseStage === undefined) {
    return 'stable'
  }

  if (prereleaseStage === 'alpha' || prereleaseStage === 'beta' || prereleaseStage === 'rc') {
    return prereleaseStage
  }

  return 'experimental'
}

export function getRecommendedExtensionApiRange(
  apiVersion: string = EXTENSION_API_VERSION
): string {
  const parsed = parseExtensionApiVersion(apiVersion)
  const normalizedVersion = parsed.version
  const stage = getExtensionApiVersionStage(normalizedVersion)

  if (stage === 'rc') {
    const targetVersion = `${parsed.major}.${parsed.minor}.${parsed.patch}`
    return `>=${targetVersion}-rc.1 <${targetVersion}`
  }

  if (stage === 'stable') {
    return `^${normalizedVersion}`
  }

  return `=${normalizedVersion}`
}

export function getRecommendedExtensionApiDistTag(
  apiVersion: string = EXTENSION_API_VERSION
): ExtensionApiDistTag {
  const stage = getExtensionApiVersionStage(apiVersion)

  return stage === 'stable' ? 'latest' : stage
}

function parseExtensionApiVersion(apiVersion: string): SemVer {
  const parsed = semver.parse(apiVersion)
  if (!parsed) {
    throw new Error(`Invalid Kisaki Extension API version: ${apiVersion}`)
  }

  return parsed
}

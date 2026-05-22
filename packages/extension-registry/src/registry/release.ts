import semver from 'semver'
import {
  EXTENSION_REGISTRY_PREVIEW_RELEASE_PREFIXES,
  type ExtensionRegistryPreviewReleasePrefix,
  type ExtensionRegistryReleaseKind
} from './manifest'

export function getExtensionRegistryReleaseKind(version: string): ExtensionRegistryReleaseKind {
  return semver.prerelease(version) ? 'preview' : 'stable'
}

export function getExtensionRegistryPreviewReleasePrefix(
  version: string
): ExtensionRegistryPreviewReleasePrefix | null {
  const prefix = semver.prerelease(version)?.[0]
  if (typeof prefix !== 'string') {
    return null
  }

  return isExtensionRegistryPreviewReleasePrefix(prefix) ? prefix : null
}

export function isExtensionRegistryPreviewReleasePrefix(
  value: string
): value is ExtensionRegistryPreviewReleasePrefix {
  return (EXTENSION_REGISTRY_PREVIEW_RELEASE_PREFIXES as readonly string[]).includes(value)
}

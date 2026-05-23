import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { ExtensionRegistryArtifact } from './artifact'

export const EXTENSION_REGISTRY_SCHEMA_URL =
  'https://kisaki.me/schemas/extension-registry.schema.json'
export const EXTENSION_REGISTRY_SCHEMA_VERSION = 1

export const EXTENSION_REGISTRY_SIGNING_ALGORITHMS = ['ed25519'] as const
export const EXTENSION_REGISTRY_RELEASE_KINDS = ['stable', 'preview'] as const
export const EXTENSION_REGISTRY_PREVIEW_RELEASE_PREFIXES = [
  'alpha',
  'beta',
  'rc',
  'nightly'
] as const

export type ExtensionRegistrySchemaVersion = typeof EXTENSION_REGISTRY_SCHEMA_VERSION
export type ExtensionRegistrySigningAlgorithm =
  (typeof EXTENSION_REGISTRY_SIGNING_ALGORITHMS)[number]
export type ExtensionRegistryReleaseKind = (typeof EXTENSION_REGISTRY_RELEASE_KINDS)[number]
export type ExtensionRegistryPreviewReleasePrefix =
  (typeof EXTENSION_REGISTRY_PREVIEW_RELEASE_PREFIXES)[number]

export interface ExtensionRegistryManifest {
  readonly $schema?: string
  readonly schemaVersion: ExtensionRegistrySchemaVersion
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly homepage?: string
  readonly updatedAt: string
  readonly signingKeys: readonly ExtensionRegistrySigningKey[]
  readonly packages: readonly ExtensionRegistryPackage[]
}

export interface ExtensionRegistrySigningKey {
  readonly id: string
  readonly algorithm: ExtensionRegistrySigningAlgorithm
  readonly publicKey: string
}

export interface ExtensionRegistryPackageOwner {
  readonly name: string
  readonly url?: string
}

export interface ExtensionRegistryPackageIcon {
  readonly url: string
  readonly sha256?: string
}

export interface ExtensionRegistryPackage {
  readonly id: string
  readonly name: string
  readonly summary: string
  readonly description?: string
  readonly categories: readonly ExtensionCategory[]
  readonly keywords?: readonly string[]
  readonly owner?: ExtensionRegistryPackageOwner
  readonly homepage?: string
  readonly repository?: string
  readonly license?: string
  readonly icon?: ExtensionRegistryPackageIcon
  readonly releases: readonly ExtensionRegistryRelease[]
}

export interface ExtensionRegistryReleaseEngines {
  readonly kisaki: string
}

export interface ExtensionRegistryReleaseChangelog {
  readonly text?: string
  readonly url?: string
}

export interface ExtensionRegistryRelease {
  readonly version: string
  readonly publishedAt: string
  readonly engines: ExtensionRegistryReleaseEngines
  readonly changelog?: ExtensionRegistryReleaseChangelog
  readonly yanked?: boolean
  readonly artifacts: readonly ExtensionRegistryArtifact[]
}

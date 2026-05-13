import type { ExtensionCategory } from '@kisaki/extension-api'
import type { ExtensionRegistryArtifact } from './artifact'

export const EXTENSION_REGISTRY_SCHEMA_URL =
  'https://kisaki.dev/schemas/extension-registry.schema.json'
export const EXTENSION_REGISTRY_SCHEMA_VERSION = 1

export const EXTENSION_REGISTRY_SIGNING_ALGORITHMS = ['ed25519'] as const
export const EXTENSION_REGISTRY_KNOWN_RELEASE_CHANNELS = ['stable', 'beta', 'nightly'] as const

export type ExtensionRegistrySchemaVersion = typeof EXTENSION_REGISTRY_SCHEMA_VERSION
export type ExtensionRegistrySigningAlgorithm =
  (typeof EXTENSION_REGISTRY_SIGNING_ALGORITHMS)[number]
export type ExtensionRegistryKnownReleaseChannel =
  (typeof EXTENSION_REGISTRY_KNOWN_RELEASE_CHANNELS)[number]
export type ExtensionRegistryReleaseChannel = ExtensionRegistryKnownReleaseChannel | (string & {})

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
  readonly channel: ExtensionRegistryReleaseChannel
  readonly publishedAt: string
  readonly engines: ExtensionRegistryReleaseEngines
  readonly changelog?: ExtensionRegistryReleaseChangelog
  readonly yanked?: boolean
  readonly artifacts: readonly ExtensionRegistryArtifact[]
}

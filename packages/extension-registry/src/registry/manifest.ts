import type { ExtensionCategory } from '@kisaki3/extension-api'
import type { ExtensionRegistryArtifact } from './artifact'

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

export interface ExtensionRegistryLocalizedDocument {
  readonly summary: string
  readonly body?: string
}

export interface ExtensionRegistryLocalizedDocumentSet {
  readonly defaultLocale: string
  readonly locales: Readonly<Record<string, ExtensionRegistryLocalizedDocument>>
}

export interface ExtensionRegistryPackage {
  readonly id: string
  readonly name: string
  readonly description: ExtensionRegistryLocalizedDocumentSet
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
  readonly kisakiExtensionApi: string
}

export interface ExtensionRegistryReleaseYank {
  readonly at: string
  readonly reason?: string
}

export interface ExtensionRegistryRelease {
  readonly version: string
  readonly publishedAt: string
  readonly engines: ExtensionRegistryReleaseEngines
  readonly releasePage?: string
  readonly changelog?: ExtensionRegistryLocalizedDocumentSet
  readonly yanked?: ExtensionRegistryReleaseYank
  readonly artifacts: readonly ExtensionRegistryArtifact[]
}

/** Metadata used to create an empty extension registry manifest. */
export interface CreateExtensionRegistryManifestInput {
  $schema?: string
  id: string
  name: string
  description?: string
  homepage?: string
  updatedAt?: string
}

/** Creates the canonical empty extension registry manifest. */
export function createExtensionRegistryManifest(
  input: CreateExtensionRegistryManifestInput
): ExtensionRegistryManifest {
  return compactExtensionRegistryManifest({
    $schema: input.$schema,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    description: input.description,
    homepage: input.homepage,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    signingKeys: [],
    packages: []
  })
}

/** Recursively removes undefined fields from registry JSON objects. */
export function compactExtensionRegistryManifest(manifest: unknown): ExtensionRegistryManifest {
  return removeUndefined(manifest) as ExtensionRegistryManifest
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefined)
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, removeUndefined(entry)])
  )
}

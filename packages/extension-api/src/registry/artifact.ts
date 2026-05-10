import process from 'node:process'
import type {
  ExtensionRegistryRelease,
  ExtensionRegistryReleaseChannel,
  ExtensionRegistryReleaseEngines,
  ExtensionRegistrySchemaVersion,
  ExtensionRegistrySigningAlgorithm
} from './manifest'
import { EXTENSION_REGISTRY_SCHEMA_VERSION } from './manifest'

export const EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND = 'kisaki-extension-artifact-signature'

export type ExtensionRegistryArtifactTarget = 'any' | `${string}-${string}`

export interface ExtensionRegistryArtifact {
  readonly target: ExtensionRegistryArtifactTarget
  readonly url: string
  readonly size: number
  readonly sha256: string
  readonly signature?: ExtensionRegistryArtifactSignature
}

export interface ExtensionRegistryArtifactSignature {
  readonly keyId: string
  readonly algorithm: ExtensionRegistrySigningAlgorithm
  readonly value: string
}

export interface ExtensionRegistryArtifactSignaturePayload {
  readonly kind: typeof EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND
  readonly schemaVersion: ExtensionRegistrySchemaVersion
  readonly extensionId: string
  readonly version: string
  readonly channel: ExtensionRegistryReleaseChannel
  readonly engines: ExtensionRegistryReleaseEngines
  readonly target: ExtensionRegistryArtifactTarget
  readonly size: number
  readonly sha256: string
}

export function getCurrentExtensionRegistryArtifactTarget(): ExtensionRegistryArtifactTarget {
  return `${process.platform}-${process.arch}` as ExtensionRegistryArtifactTarget
}

export function isExtensionRegistryArtifactTargetCompatible(
  target: ExtensionRegistryArtifactTarget,
  platform = process.platform,
  arch = process.arch
): boolean {
  return target === 'any' || target === `${platform}-${arch}`
}

export function selectExtensionRegistryArtifact(
  release: Pick<ExtensionRegistryRelease, 'artifacts'>,
  platform = process.platform,
  arch = process.arch
): ExtensionRegistryArtifact | null {
  const exactTarget = `${platform}-${arch}`
  const exact = release.artifacts.find((artifact) => artifact.target === exactTarget)

  if (exact) {
    return exact
  }

  return release.artifacts.find((artifact) => artifact.target === 'any') ?? null
}

export function createExtensionRegistryArtifactSignaturePayload(
  extensionId: string,
  release: Pick<ExtensionRegistryRelease, 'version' | 'channel' | 'engines'>,
  artifact: Pick<ExtensionRegistryArtifact, 'target' | 'size' | 'sha256'>
): ExtensionRegistryArtifactSignaturePayload {
  return {
    kind: EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    extensionId,
    version: release.version,
    channel: release.channel,
    engines: {
      kisaki: release.engines.kisaki.trim()
    },
    target: artifact.target,
    size: artifact.size,
    sha256: artifact.sha256
  }
}

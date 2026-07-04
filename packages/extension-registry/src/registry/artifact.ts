import type {
  ExtensionRegistryRelease,
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
  readonly engines: ExtensionRegistryReleaseEngines
  readonly target: ExtensionRegistryArtifactTarget
  readonly size: number
  readonly sha256: string
}

export function getCurrentExtensionRegistryArtifactTarget(): ExtensionRegistryArtifactTarget {
  return `${getRuntimePlatform()}-${getRuntimeArch()}` as ExtensionRegistryArtifactTarget
}

export function isExtensionRegistryArtifactTargetCompatible(
  target: ExtensionRegistryArtifactTarget,
  platform = getRuntimePlatform(),
  arch = getRuntimeArch()
): boolean {
  return target === 'any' || target === `${platform}-${arch}`
}

export function selectExtensionRegistryArtifact(
  release: Pick<ExtensionRegistryRelease, 'artifacts'>,
  platform = getRuntimePlatform(),
  arch = getRuntimeArch()
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
  release: Pick<ExtensionRegistryRelease, 'version' | 'engines'>,
  artifact: Pick<ExtensionRegistryArtifact, 'target' | 'size' | 'sha256'>
): ExtensionRegistryArtifactSignaturePayload {
  return {
    kind: EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    extensionId,
    version: release.version,
    engines: {
      kisakiExtensionApi: release.engines.kisakiExtensionApi.trim()
    },
    target: artifact.target,
    size: artifact.size,
    sha256: artifact.sha256
  }
}

interface RuntimeProcessLike {
  platform?: unknown
  arch?: unknown
}

function getRuntimePlatform(): string {
  return getRuntimeProcessField('platform') ?? 'browser'
}

function getRuntimeArch(): string {
  return getRuntimeProcessField('arch') ?? 'unknown'
}

function getRuntimeProcessField(field: keyof RuntimeProcessLike): string | null {
  const processLike = (globalThis as { process?: RuntimeProcessLike }).process
  const value = processLike?.[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}

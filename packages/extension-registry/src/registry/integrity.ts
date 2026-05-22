import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import type { ExtensionRegistryArtifact, ExtensionRegistryArtifactTarget } from './artifact'
import type {
  ExtensionRegistryManifest,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease,
  ExtensionRegistryReleaseEngines,
  ExtensionRegistrySchemaVersion,
  ExtensionRegistrySigningAlgorithm,
  ExtensionRegistrySigningKey
} from './manifest'

export type ExtensionRegistryCanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ExtensionRegistryCanonicalJsonValue[]
  | { readonly [key: string]: ExtensionRegistryCanonicalJsonValue }

export interface ExtensionRegistryReleaseDigestPayload {
  readonly kind: 'kisaki-extension-registry-release'
  readonly schemaVersion: ExtensionRegistrySchemaVersion
  readonly packageId: string
  readonly version: string
  readonly engines: ExtensionRegistryReleaseEngines
  readonly artifacts: readonly ExtensionRegistryReleaseDigestArtifact[]
}

export interface ExtensionRegistryReleaseDigestArtifact {
  readonly target: ExtensionRegistryArtifactTarget
  readonly size: number
  readonly sha256: string
  readonly signature?: ExtensionRegistryReleaseDigestArtifactSignature
}

export interface ExtensionRegistryReleaseDigestArtifactSignature {
  readonly algorithm: ExtensionRegistrySigningAlgorithm
  readonly signerFingerprint: string
  readonly value: string
}

export function createExtensionRegistryReleaseDigestPayload(
  manifest: Pick<ExtensionRegistryManifest, 'schemaVersion' | 'signingKeys'>,
  registryPackage: Pick<ExtensionRegistryPackage, 'id'>,
  release: Pick<ExtensionRegistryRelease, 'version' | 'engines' | 'artifacts'>
): ExtensionRegistryReleaseDigestPayload {
  const artifacts = release.artifacts.map((artifact) =>
    createReleaseDigestArtifact(artifact, manifest.signingKeys)
  )

  return {
    kind: 'kisaki-extension-registry-release',
    schemaVersion: manifest.schemaVersion,
    packageId: registryPackage.id,
    version: release.version,
    engines: {
      kisaki: release.engines.kisaki.trim()
    },
    artifacts: artifacts.toSorted(compareReleaseDigestArtifacts)
  }
}

export function createExtensionRegistryReleaseDigest(
  manifest: Pick<ExtensionRegistryManifest, 'schemaVersion' | 'signingKeys'>,
  registryPackage: Pick<ExtensionRegistryPackage, 'id'>,
  release: Pick<ExtensionRegistryRelease, 'version' | 'engines' | 'artifacts'>
): string {
  const payload = createExtensionRegistryReleaseDigestPayload(manifest, registryPackage, release)
  return createHash('sha256').update(stringifyExtensionRegistryCanonicalJson(payload)).digest('hex')
}

export function stringifyExtensionRegistryCanonicalJson(
  value: ExtensionRegistryCanonicalJsonValue | unknown
): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value)
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON numbers must be finite.')
    }

    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stringifyExtensionRegistryCanonicalJson(item)).join(',')}]`
  }

  if (!value || typeof value !== 'object') {
    throw new TypeError('Canonical JSON values must be JSON primitives, arrays or objects.')
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Canonical JSON objects must be plain objects.')
  }

  const entries = Object.entries(value as Record<string, unknown>).toSorted(
    ([leftKey], [rightKey]) => compareStrings(leftKey, rightKey)
  )
  const encodedEntries = entries.map(([key, entry]) => {
    if (entry === undefined) {
      throw new TypeError('Canonical JSON object values must not be undefined.')
    }

    return `${JSON.stringify(key)}:${stringifyExtensionRegistryCanonicalJson(entry)}`
  })

  return `{${encodedEntries.join(',')}}`
}

export function createExtensionRegistrySignerFingerprint(publicKey: string | Uint8Array): string {
  const publicKeyBytes =
    typeof publicKey === 'string' ? Buffer.from(publicKey, 'base64') : publicKey
  return createHash('sha256').update(publicKeyBytes).digest('hex')
}

function createReleaseDigestArtifact(
  artifact: ExtensionRegistryArtifact,
  signingKeys: readonly ExtensionRegistrySigningKey[]
): ExtensionRegistryReleaseDigestArtifact {
  if (!artifact.signature) {
    return {
      target: artifact.target,
      size: artifact.size,
      sha256: artifact.sha256
    }
  }

  const signingKey = signingKeys.find((key) => key.id === artifact.signature?.keyId)

  if (!signingKey) {
    throw new Error(
      `Cannot create extension registry release digest: signing key "${artifact.signature.keyId}" is not declared.`
    )
  }

  return {
    target: artifact.target,
    size: artifact.size,
    sha256: artifact.sha256,
    signature: {
      algorithm: artifact.signature.algorithm,
      signerFingerprint: createExtensionRegistrySignerFingerprint(signingKey.publicKey),
      value: artifact.signature.value
    }
  }
}

function compareReleaseDigestArtifacts(
  left: ExtensionRegistryReleaseDigestArtifact,
  right: ExtensionRegistryReleaseDigestArtifact
): number {
  return (
    compareStrings(left.target, right.target) ||
    compareStrings(left.sha256, right.sha256) ||
    compareStrings(
      left.signature?.signerFingerprint ?? '',
      right.signature?.signerFingerprint ?? ''
    )
  )
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1
  }

  if (left > right) {
    return 1
  }

  return 0
}

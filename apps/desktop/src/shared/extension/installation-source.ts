import type { ExtensionCategory } from '@kisaki3/extension-api'
import type {
  ExtensionRegistryArtifact,
  ExtensionRegistryPackage,
  ExtensionRegistryRelease,
  ExtensionRegistrySchemaVersion,
  ExtensionRegistrySigningKey
} from '@kisaki3/extension-registry'

export type ExtensionInstallationSource =
  | ExtensionRepositoryInstallationSource
  | ExtensionLocalFileInstallationSource

export interface ExtensionRepositoryInstallationSource {
  kind: 'repository'
  repositoryId: string
  repositoryUrl: string
  releaseId: string
  manifestDigest: string
  artifact: {
    url: string
    sha256: string
  }
  snapshot: ExtensionRepositoryInstallationSnapshot
  signature?: {
    keyId?: string
    fingerprint: string
  }
}

export interface ExtensionRepositoryInstallationSnapshot {
  schemaVersion: ExtensionRegistrySchemaVersion
  signingKeys: readonly ExtensionRegistrySigningKey[]
  package: Pick<ExtensionRegistryPackage, 'id' | 'categories'>
  release: ExtensionRegistryRelease
}

export interface ExtensionLocalFileInstallationSource {
  kind: 'local-file'
  path: string
  artifactSha256: string
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/
const ISO_UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/
const SUPPORTED_SCHEMA_VERSION = 1 satisfies ExtensionRegistrySchemaVersion

export function parseExtensionInstallationSource(
  value: unknown
): ExtensionInstallationSource | null {
  if (!isPlainRecord(value)) {
    return null
  }

  if (value.kind === 'repository') {
    return parseRepositoryInstallationSource(value)
  }

  if (value.kind === 'local-file') {
    return parseLocalFileInstallationSource(value)
  }

  return null
}

export function isExtensionInstallationSource(
  value: unknown
): value is ExtensionInstallationSource {
  return parseExtensionInstallationSource(value) !== null
}

function parseRepositoryInstallationSource(
  value: Record<string, unknown>
): ExtensionRepositoryInstallationSource | null {
  if (
    !isNonEmptyString(value.repositoryId) ||
    !isValidUrl(value.repositoryUrl) ||
    !isNonEmptyString(value.releaseId) ||
    !isSha256Hex(value.manifestDigest) ||
    !isPlainRecord(value.artifact) ||
    !isPlainRecord(value.snapshot)
  ) {
    return null
  }

  const artifact = parseRepositoryArtifact(value.artifact)
  const snapshot = parseRepositorySnapshot(value.snapshot)
  if (
    !artifact ||
    !snapshot ||
    !snapshot.release.artifacts.some(
      (item) => item.url === artifact.url && item.sha256 === artifact.sha256
    )
  ) {
    return null
  }

  const source: ExtensionRepositoryInstallationSource = {
    kind: 'repository',
    repositoryId: value.repositoryId,
    repositoryUrl: value.repositoryUrl,
    releaseId: value.releaseId,
    manifestDigest: value.manifestDigest,
    artifact,
    snapshot
  }

  if (value.signature !== undefined) {
    const signature = parseRepositorySignature(value.signature)
    if (!signature) {
      return null
    }
    source.signature = signature
  }

  return source
}

function parseLocalFileInstallationSource(
  value: Record<string, unknown>
): ExtensionLocalFileInstallationSource | null {
  if (!isNonEmptyString(value.path) || !isSha256Hex(value.artifactSha256)) {
    return null
  }

  return {
    kind: 'local-file',
    path: value.path,
    artifactSha256: value.artifactSha256
  }
}

function parseRepositoryArtifact(
  value: Record<string, unknown>
): ExtensionRepositoryInstallationSource['artifact'] | null {
  if (!isValidUrl(value.url) || !isSha256Hex(value.sha256)) {
    return null
  }

  return {
    url: value.url,
    sha256: value.sha256
  }
}

function parseRepositorySnapshot(
  value: Record<string, unknown>
): ExtensionRepositoryInstallationSnapshot | null {
  if (
    value.schemaVersion !== SUPPORTED_SCHEMA_VERSION ||
    !Array.isArray(value.signingKeys) ||
    !isPlainRecord(value.package) ||
    !isPlainRecord(value.release)
  ) {
    return null
  }

  const registryPackage = parseSnapshotPackage(value.package)
  const release = parseSnapshotRelease(value.release)
  const signingKeys = value.signingKeys.map(parseSigningKey)

  if (!registryPackage || !release || signingKeys.some((key) => !key)) {
    return null
  }

  return {
    schemaVersion: SUPPORTED_SCHEMA_VERSION,
    signingKeys: signingKeys as ExtensionRegistrySigningKey[],
    package: registryPackage,
    release
  }
}

function parseSnapshotPackage(
  value: Record<string, unknown>
): ExtensionRepositoryInstallationSnapshot['package'] | null {
  if (!isNonEmptyString(value.id) || !Array.isArray(value.categories)) {
    return null
  }

  const categories = value.categories.filter(isNonEmptyString) as ExtensionCategory[]
  if (categories.length !== value.categories.length) {
    return null
  }

  return {
    id: value.id,
    categories
  }
}

function parseSnapshotRelease(value: Record<string, unknown>): ExtensionRegistryRelease | null {
  if (
    !isNonEmptyString(value.version) ||
    !isNonEmptyString(value.publishedAt) ||
    !isPlainRecord(value.engines) ||
    !Array.isArray(value.artifacts)
  ) {
    return null
  }

  const engines = parseReleaseEngines(value.engines)
  const artifacts = value.artifacts.map(parseSnapshotArtifact)
  const changelog =
    value.changelog === undefined ? undefined : parseReleaseChangelog(value.changelog)
  const yanked = value.yanked === undefined ? undefined : parseReleaseYank(value.yanked)
  if (
    !engines ||
    artifacts.length === 0 ||
    artifacts.some((artifact) => !artifact) ||
    changelog === null ||
    yanked === null
  ) {
    return null
  }

  return {
    version: value.version,
    publishedAt: value.publishedAt,
    engines,
    ...(changelog ? { changelog } : {}),
    ...(yanked ? { yanked } : {}),
    artifacts: artifacts as ExtensionRegistryArtifact[]
  }
}

function parseReleaseEngines(
  value: Record<string, unknown>
): ExtensionRegistryRelease['engines'] | null {
  if (!isNonEmptyString(value.kisaki)) {
    return null
  }

  return {
    kisaki: value.kisaki
  }
}

function parseReleaseChangelog(value: unknown): ExtensionRegistryRelease['changelog'] | null {
  if (!isPlainRecord(value)) {
    return null
  }

  if (value.text !== undefined && !isNonEmptyString(value.text)) {
    return null
  }

  if (value.url !== undefined && !isValidUrl(value.url)) {
    return null
  }

  return {
    ...(value.text ? { text: value.text } : {}),
    ...(value.url ? { url: value.url } : {})
  }
}

function parseReleaseYank(value: unknown): ExtensionRegistryRelease['yanked'] | null {
  if (!isPlainRecord(value) || !isIsoUtcDateString(value.at)) {
    return null
  }

  if (value.reason !== undefined && !isNonEmptyString(value.reason)) {
    return null
  }

  return {
    at: value.at,
    ...(value.reason ? { reason: value.reason } : {})
  }
}

function parseSnapshotArtifact(value: unknown): ExtensionRegistryArtifact | null {
  if (!isPlainRecord(value)) {
    return null
  }

  if (
    !isNonEmptyString(value.target) ||
    !isValidUrl(value.url) ||
    typeof value.size !== 'number' ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0 ||
    !isSha256Hex(value.sha256)
  ) {
    return null
  }

  const signature =
    value.signature === undefined ? undefined : parseArtifactSignature(value.signature)
  if (signature === null) {
    return null
  }

  return {
    target: value.target as ExtensionRegistryArtifact['target'],
    url: value.url,
    size: value.size,
    sha256: value.sha256,
    ...(signature ? { signature } : {})
  }
}

function parseArtifactSignature(value: unknown): ExtensionRegistryArtifact['signature'] | null {
  if (!isPlainRecord(value)) {
    return null
  }

  if (
    !isNonEmptyString(value.keyId) ||
    value.algorithm !== 'ed25519' ||
    !isNonEmptyString(value.value)
  ) {
    return null
  }

  return {
    keyId: value.keyId,
    algorithm: 'ed25519',
    value: value.value
  }
}

function parseSigningKey(value: unknown): ExtensionRegistrySigningKey | null {
  if (!isPlainRecord(value)) {
    return null
  }

  if (
    !isNonEmptyString(value.id) ||
    value.algorithm !== 'ed25519' ||
    !isNonEmptyString(value.publicKey)
  ) {
    return null
  }

  return {
    id: value.id,
    algorithm: 'ed25519',
    publicKey: value.publicKey
  }
}

function parseRepositorySignature(
  value: unknown
): ExtensionRepositoryInstallationSource['signature'] | null {
  if (!isPlainRecord(value) || !isSha256Hex(value.fingerprint)) {
    return null
  }

  if (value.keyId !== undefined && !isNonEmptyString(value.keyId)) {
    return null
  }

  return {
    ...(value.keyId ? { keyId: value.keyId } : {}),
    fingerprint: value.fingerprint
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === 'string' && SHA256_HEX_PATTERN.test(value)
}

function isValidUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function isIsoUtcDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = ISO_UTC_PATTERN.exec(value)
  if (!match) {
    return false
  }

  const fraction = match[7] ?? ''
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${fraction.padEnd(3, '0')}Z`
  const parsed = new Date(value)

  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === normalized
}

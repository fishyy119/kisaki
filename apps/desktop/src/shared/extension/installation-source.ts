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
  signature?: {
    keyId?: string
    fingerprint: string
  }
}

export interface ExtensionLocalFileInstallationSource {
  kind: 'local-file'
  path: string
  artifactSha256: string
}

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/

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
    !isPlainRecord(value.artifact)
  ) {
    return null
  }

  const artifact = parseRepositoryArtifact(value.artifact)
  if (!artifact) {
    return null
  }

  const source: ExtensionRepositoryInstallationSource = {
    kind: 'repository',
    repositoryId: value.repositoryId,
    repositoryUrl: value.repositoryUrl,
    releaseId: value.releaseId,
    manifestDigest: value.manifestDigest,
    artifact
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

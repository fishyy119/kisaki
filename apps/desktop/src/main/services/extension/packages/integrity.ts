import { createHash } from 'node:crypto'
import path from 'node:path'
import { lstat, readFile, readdir } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import type { ExtensionInstallationRow } from '@shared/db'
import type {
  ExtensionInstallationSource,
  ExtensionRepositoryInstallationSource
} from '@shared/extension/installation-source'
import type { ExtensionRegistryArtifact } from '@kisaki3/extension-registry'
import { createExtensionRegistryReleaseDigest } from '@kisaki3/extension-registry/node'
import { resolveInsideRoot } from '../shared/path-confinement'
import type { ExtensionPackageArchiveStore } from './archive'
import { readExtensionManifestFile, validateInstalledExtensionPackage } from './manifest'
import { ExtensionPackageVerifier, hashFile, type ExtensionPackageArchiveEntry } from './verifier'

export interface ExtensionPackageInspection {
  valid: boolean
  extensionId: string | null
  version: string | null
}

export interface ExtensionPackageIntegrityIssue {
  message: string
}

export async function inspectPackageDirectory(
  packageDir: string
): Promise<ExtensionPackageInspection> {
  try {
    const parsed = await readExtensionManifestFile(path.join(packageDir, 'manifest.json'))
    if (!parsed.manifest) {
      return { valid: false, extensionId: null, version: null }
    }

    const issues = await validateInstalledExtensionPackage(packageDir, parsed.manifest)
    return {
      valid: issues.length === 0,
      extensionId: parsed.manifest.id,
      version: parsed.manifest.version
    }
  } catch {
    return { valid: false, extensionId: null, version: null }
  }
}

export async function validateInstalledPackageIntegrity(
  archiveStore: ExtensionPackageArchiveStore,
  installation: ExtensionInstallationRow,
  packageDir: string
): Promise<string | null> {
  const inspected = await inspectPackageDirectory(packageDir)
  if (!inspected.valid) {
    return 'the package manifest or declared files are invalid'
  }

  if (inspected.extensionId !== installation.id) {
    return `package id mismatch: expected "${installation.id}", received "${
      inspected.extensionId ?? 'unknown'
    }"`
  }

  if (inspected.version !== installation.version) {
    return `package version mismatch: expected "${installation.version}", received "${
      inspected.version ?? 'unknown'
    }"`
  }

  try {
    await verifyInstalledPackageArchive(archiveStore, installation, packageDir)
    return null
  } catch (error) {
    return getErrorMessage(error)
  }
}

export function createRetainedArchiveSha256Set(
  installations: readonly ExtensionInstallationRow[]
): ReadonlySet<string> {
  const retained = new Set<string>()
  for (const installation of installations) {
    const source = installation.source
    if (source) {
      retained.add(getInstallationArchiveSha256(source))
    }
  }

  return retained
}

function getInstallationArchiveSha256(source: ExtensionInstallationSource): string {
  return source.kind === 'repository' ? source.artifact.sha256 : source.artifactSha256
}

async function verifyInstalledPackageArchive(
  archiveStore: ExtensionPackageArchiveStore,
  installation: ExtensionInstallationRow,
  packageDir: string
): Promise<void> {
  const source = installation.source
  if (!source) {
    throw new Error('installation source is missing or invalid')
  }
  const archivePath = await archiveStore.requireArchive(getInstallationArchiveSha256(source))

  const verifier = new ExtensionPackageVerifier()
  if (source.kind === 'repository') {
    await verifyRepositoryInstalledArchive(verifier, source, archivePath, packageDir)
    return
  }

  const verified = await verifier.verifyArchive({
    archivePath,
    expectedIdentity: {
      extensionId: installation.id,
      version: installation.version
    }
  })
  if (verified.sha256 !== source.artifactSha256) {
    throw new Error('local package archive sha256 checksum mismatch')
  }

  await assertPackageDirectoryMatchesArchive(packageDir, archivePath, verified.entries)
}

async function verifyRepositoryInstalledArchive(
  verifier: ExtensionPackageVerifier,
  source: ExtensionRepositoryInstallationSource,
  archivePath: string,
  packageDir: string
): Promise<void> {
  const snapshot = source.snapshot
  const releaseDigest = createExtensionRegistryReleaseDigest(
    {
      schemaVersion: snapshot.schemaVersion,
      signingKeys: snapshot.signingKeys
    },
    snapshot.package,
    snapshot.release
  )
  if (releaseDigest !== source.releaseId) {
    throw new Error('repository release digest no longer matches the installed source snapshot')
  }

  const artifact = snapshot.release.artifacts.find(
    (item) => item.url === source.artifact.url && item.sha256 === source.artifact.sha256
  )
  if (!artifact) {
    throw new Error('installed repository artifact is missing from the source snapshot')
  }

  const verified = await verifier.verifyArchive({
    archivePath,
    expectedArtifact: artifact,
    registryPackage: snapshot.package,
    registryRelease: snapshot.release,
    signingKeys: snapshot.signingKeys
  })

  assertRepositorySignatureMatchesSource(artifact, source, verified.signature)
  await assertPackageDirectoryMatchesArchive(packageDir, archivePath, verified.entries)
}

function assertRepositorySignatureMatchesSource(
  artifact: ExtensionRegistryArtifact,
  source: ExtensionRepositoryInstallationSource,
  signature: { keyId: string; fingerprint: string } | null
): void {
  if (!artifact.signature) {
    if (source.signature) {
      throw new Error('unsigned repository artifact has a recorded signer fingerprint')
    }
    return
  }

  if (!signature) {
    throw new Error('signed repository artifact did not produce a verified signer fingerprint')
  }

  if (!source.signature) {
    throw new Error('signed repository artifact is missing its recorded signer fingerprint')
  }

  if (source.signature.keyId && source.signature.keyId !== signature.keyId) {
    throw new Error('repository artifact signer key id mismatch')
  }

  if (source.signature.fingerprint !== signature.fingerprint) {
    throw new Error('repository artifact signer fingerprint mismatch')
  }
}

async function assertPackageDirectoryMatchesArchive(
  packageDir: string,
  archivePath: string,
  entries: readonly ExtensionPackageArchiveEntry[]
): Promise<void> {
  const expectedNames = new Set(entries.map((entry) => entry.normalizedName))
  const actualNames = await collectPackageFileNames(packageDir)
  const extraName = actualNames.find((name) => !expectedNames.has(name))
  if (extraName) {
    throw new Error(`installed package contains an unexpected file "${extraName}"`)
  }

  const archive = unzipSync(await readFile(archivePath))
  for (const entry of entries) {
    const archiveBytes = archive[entry.archiveName]
    if (!archiveBytes) {
      throw new Error(`verified archive entry "${entry.archiveName}" is missing`)
    }

    const filePath = resolveInsideRoot(packageDir, entry.normalizedName)
    const fileStat = await lstat(filePath).catch(() => null)
    if (!fileStat?.isFile()) {
      throw new Error(`installed package file "${entry.normalizedName}" is missing`)
    }

    const fileInfo = await hashFile(filePath)
    if (
      fileInfo.size !== archiveBytes.byteLength ||
      fileInfo.sha256 !== createSha256(archiveBytes)
    ) {
      throw new Error(`installed package file "${entry.normalizedName}" does not match archive`)
    }
  }
}

async function collectPackageFileNames(packageDir: string): Promise<string[]> {
  const names: string[] = []
  await collectPackageFileNamesInto(packageDir, packageDir, names)
  return names
}

async function collectPackageFileNamesInto(
  rootDir: string,
  directory: string,
  names: string[]
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectPackageFileNamesInto(rootDir, entryPath, names)
      continue
    }

    const relativePath = path.relative(rootDir, entryPath).split(path.sep).join('/')
    names.push(relativePath)
  }
}

function createSha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

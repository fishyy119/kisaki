import { createReadStream } from 'node:fs'
import { Buffer } from 'node:buffer'
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Writable } from 'node:stream'
import { app } from 'electron'
import AdmZip from 'adm-zip'
import fse from 'fs-extra'
import semver from 'semver'
import {
  createExtensionRegistryArtifactSignaturePayload,
  createExtensionRegistrySignerFingerprint,
  normalizeExtensionPackagePath,
  stringifyExtensionRegistryCanonicalJson,
  type ExtensionCategory,
  type ExtensionManifest,
  type ExtensionRegistryArtifact,
  type ExtensionRegistryPackage,
  type ExtensionRegistryRelease,
  type ExtensionRegistrySigningKey
} from '@kisaki/extension-api'
import {
  parseExtensionManifest,
  readExtensionManifestFile,
  validateInstalledExtensionPackage
} from './manifest'
import { wrapExtensionPackageError } from './types'

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/
const ED25519_RAW_PUBLIC_KEY_BYTES = 32
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const WINDOWS_DEVICE_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9'
])

export interface ExtensionPackageExpectedIdentity {
  extensionId?: string
  version?: string
  categories?: readonly ExtensionCategory[]
  enginesKisaki?: string
}

export interface VerifyExtensionPackageArchiveInput {
  archivePath: string
  expectedArtifact?: Pick<ExtensionRegistryArtifact, 'size' | 'sha256' | 'signature' | 'target'>
  expectedIdentity?: ExtensionPackageExpectedIdentity
  registryPackage?: Pick<ExtensionRegistryPackage, 'id' | 'categories'>
  registryRelease?: Pick<ExtensionRegistryRelease, 'version' | 'channel' | 'engines'>
  signingKeys?: readonly ExtensionRegistrySigningKey[]
  allowIncompatibleKisaki?: boolean
  signal?: AbortSignal
}

export interface ExtensionPackageArchiveVerificationResult {
  archivePath: string
  size: number
  sha256: string
  manifest: ExtensionManifest
  entries: readonly ExtensionPackageArchiveEntry[]
  signature: ExtensionPackageSignatureVerificationResult | null
}

export interface ExtensionPackageArchiveEntry {
  archiveName: string
  normalizedName: string
}

export interface ExtensionPackageSignatureVerificationResult {
  keyId: string
  fingerprint: string
}

export interface VerifyExtensionPackageDirectoryInput {
  packageDir: string
  expectedIdentity?: ExtensionPackageExpectedIdentity
}

export class ExtensionPackageVerifier {
  async verifyArchive(
    input: VerifyExtensionPackageArchiveInput
  ): Promise<ExtensionPackageArchiveVerificationResult> {
    try {
      const [fileInfo, archiveInfo] = await Promise.all([
        hashFile(input.archivePath, input.signal),
        inspectArchive(input.archivePath)
      ])

      if (input.expectedArtifact) {
        verifyArtifactFileInfo(fileInfo, input.expectedArtifact)
      }

      verifyManifestIdentity(archiveInfo.manifest, {
        ...input.expectedIdentity,
        extensionId: input.expectedIdentity?.extensionId ?? input.registryPackage?.id,
        version: input.expectedIdentity?.version ?? input.registryRelease?.version,
        categories: input.expectedIdentity?.categories ?? input.registryPackage?.categories,
        enginesKisaki:
          input.expectedIdentity?.enginesKisaki ?? input.registryRelease?.engines.kisaki
      })

      if (!input.allowIncompatibleKisaki) {
        verifyKisakiCompatibility(archiveInfo.manifest.engines?.kisaki)
        verifyKisakiCompatibility(input.registryRelease?.engines.kisaki)
      }

      const signature = input.expectedArtifact?.signature
        ? verifyArtifactSignature({
            extensionId: input.registryPackage?.id ?? archiveInfo.manifest.id,
            release: input.registryRelease,
            artifact: input.expectedArtifact,
            signingKeys: input.signingKeys ?? []
          })
        : null

      return {
        archivePath: input.archivePath,
        size: fileInfo.size,
        sha256: fileInfo.sha256,
        manifest: archiveInfo.manifest,
        entries: archiveInfo.entries,
        signature
      }
    } catch (error) {
      throw wrapExtensionPackageError(error, {
        stage: 'verify',
        message: 'Failed to verify extension package archive',
        path: input.archivePath
      })
    }
  }

  async verifyPackageDirectory(
    input: VerifyExtensionPackageDirectoryInput
  ): Promise<ExtensionManifest> {
    try {
      const parsed = await readExtensionManifestFile(`${input.packageDir}/manifest.json`)
      if (!parsed.manifest) {
        throw new Error(formatManifestIssues(parsed.issues))
      }

      verifyManifestIdentity(parsed.manifest, input.expectedIdentity)
      verifyKisakiCompatibility(parsed.manifest.engines?.kisaki)

      const issues = await validateInstalledExtensionPackage(input.packageDir, parsed.manifest)
      if (issues.length > 0) {
        throw new Error(formatManifestIssues(issues))
      }

      return parsed.manifest
    } catch (error) {
      throw wrapExtensionPackageError(error, {
        stage: 'verify',
        message: 'Failed to verify extension package directory',
        path: input.packageDir
      })
    }
  }
}

export async function hashFile(
  filePath: string,
  signal?: AbortSignal
): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256')
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      hash.update(chunk)
      callback()
    }
  })

  assertNotAborted(signal)
  await pipeline(createReadStream(filePath), sink, { signal })
  assertNotAborted(signal)
  const stat = await fse.stat(filePath)
  return {
    size: stat.size,
    sha256: hash.digest('hex')
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Extension package operation was cancelled.')
    error.name = 'AbortError'
    throw error
  }
}

export function verifyArtifactSignature(input: {
  extensionId: string
  release?: Pick<ExtensionRegistryRelease, 'version' | 'channel' | 'engines'>
  artifact: Pick<ExtensionRegistryArtifact, 'target' | 'size' | 'sha256' | 'signature'>
  signingKeys: readonly ExtensionRegistrySigningKey[]
}): ExtensionPackageSignatureVerificationResult {
  const signature = input.artifact.signature
  if (!signature) {
    throw new Error('Artifact signature is missing.')
  }

  if (!input.release) {
    throw new Error('Registry release is required to verify artifact signature.')
  }

  const signingKey = input.signingKeys.find((key) => key.id === signature.keyId)
  if (!signingKey) {
    throw new Error(`Signing key "${signature.keyId}" is not declared by the registry manifest.`)
  }

  if (signingKey.algorithm !== 'ed25519' || signature.algorithm !== 'ed25519') {
    throw new Error('Only ed25519 extension artifact signatures are supported.')
  }

  const payload = createExtensionRegistryArtifactSignaturePayload(
    input.extensionId,
    input.release,
    input.artifact
  )
  const payloadBytes = Buffer.from(stringifyExtensionRegistryCanonicalJson(payload), 'utf8')
  const publicKey = createEd25519PublicKey(signingKey.publicKey)
  const signatureBytes = Buffer.from(signature.value, 'base64')

  if (!verifySignature(null, payloadBytes, publicKey, signatureBytes)) {
    throw new Error('Artifact signature verification failed.')
  }

  return {
    keyId: signature.keyId,
    fingerprint: createExtensionRegistrySignerFingerprint(signingKey.publicKey)
  }
}

async function inspectArchive(archivePath: string): Promise<{
  manifest: ExtensionManifest
  entries: readonly ExtensionPackageArchiveEntry[]
}> {
  const zip = new AdmZip(archivePath)
  const zipEntries = zip.getEntries()
  const manifestEntry = zip.getEntry('manifest.json')

  if (!manifestEntry) {
    throw new Error('Extension package must contain manifest.json at the archive root.')
  }

  const parsed = parseExtensionManifest(JSON.parse(manifestEntry.getData().toString('utf-8')))
  if (!parsed.manifest) {
    throw new Error(formatManifestIssues(parsed.issues))
  }

  const entries: ExtensionPackageArchiveEntry[] = []
  const normalizedNames = new Set<string>()
  const normalizedNamesLower = new Set<string>()

  for (const entry of zipEntries) {
    if (entry.isDirectory) {
      continue
    }

    const normalizedName = normalizeArchiveEntryName(entry.entryName)
    if (!normalizedName) {
      throw new Error(`Package entry "${entry.entryName}" is outside the archive root.`)
    }

    const lowerName = normalizedName.toLowerCase()
    if (normalizedNames.has(normalizedName) || normalizedNamesLower.has(lowerName)) {
      throw new Error(`Package contains duplicate entry path "${normalizedName}".`)
    }
    normalizedNames.add(normalizedName)
    normalizedNamesLower.add(lowerName)
    entries.push({
      archiveName: entry.entryName,
      normalizedName
    })
  }

  if (!normalizedNames.has('manifest.json')) {
    throw new Error('Extension package must contain manifest.json at the archive root.')
  }

  if (!normalizedNames.has(parsed.manifest.entry)) {
    throw new Error(`Extension entry "${parsed.manifest.entry}" was not found in the package.`)
  }

  if (parsed.manifest.icon && !normalizedNames.has(parsed.manifest.icon)) {
    throw new Error(`Extension icon "${parsed.manifest.icon}" was not found in the package.`)
  }

  return {
    manifest: parsed.manifest,
    entries
  }
}

function normalizeArchiveEntryName(entryName: string): string | null {
  const normalized = normalizeExtensionPackagePath(entryName)
  if (!normalized) {
    return null
  }

  for (const segment of normalized.split('/')) {
    if (isWindowsDevicePathSegment(segment)) {
      return null
    }
  }

  return normalized
}

function isWindowsDevicePathSegment(segment: string): boolean {
  const basename = segment.split('.')[0]?.toLowerCase()
  return Boolean(basename && WINDOWS_DEVICE_NAMES.has(basename))
}

function verifyArtifactFileInfo(
  actual: { size: number; sha256: string },
  expected: Pick<ExtensionRegistryArtifact, 'size' | 'sha256'>
): void {
  if (actual.size !== expected.size) {
    throw new Error(
      `Artifact size mismatch: expected ${expected.size} bytes, received ${actual.size} bytes.`
    )
  }

  if (!SHA256_HEX_PATTERN.test(expected.sha256) || actual.sha256 !== expected.sha256) {
    throw new Error('Artifact sha256 checksum mismatch.')
  }
}

function verifyManifestIdentity(
  manifest: ExtensionManifest,
  expected: ExtensionPackageExpectedIdentity | undefined
): void {
  if (!expected) {
    return
  }

  if (expected.extensionId && manifest.id !== expected.extensionId) {
    throw new Error(
      `Package id mismatch: expected "${expected.extensionId}", received "${manifest.id}".`
    )
  }

  if (expected.version && manifest.version !== expected.version) {
    throw new Error(
      `Package version mismatch: expected "${expected.version}", received "${manifest.version}".`
    )
  }

  if (expected.categories && !areCategorySetsEqual(manifest.categories, expected.categories)) {
    throw new Error('Package categories do not match the registry package categories.')
  }

  if (
    expected.enginesKisaki !== undefined &&
    (manifest.engines?.kisaki ?? '').trim() !== expected.enginesKisaki.trim()
  ) {
    throw new Error('Package engines.kisaki does not match the registry release.')
  }
}

function verifyKisakiCompatibility(range: string | undefined): void {
  if (!range) {
    return
  }

  if (!semver.satisfies(app.getVersion(), range)) {
    throw new Error(`Extension requires Kisaki ${range}, current version is ${app.getVersion()}.`)
  }
}

function areCategorySetsEqual(
  left: readonly ExtensionCategory[],
  right: readonly ExtensionCategory[]
): boolean {
  return normalizeCategorySet(left).join('\0') === normalizeCategorySet(right).join('\0')
}

function normalizeCategorySet(value: readonly ExtensionCategory[]): string[] {
  return [...new Set(value)].toSorted()
}

function createEd25519PublicKey(publicKey: string): ReturnType<typeof createPublicKey> {
  const keyBytes = Buffer.from(publicKey, 'base64')

  try {
    return createPublicKey({
      key: keyBytes,
      format: 'der',
      type: 'spki'
    })
  } catch {
    if (keyBytes.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
      throw new Error('Ed25519 public key must be a raw 32-byte key or SPKI DER.')
    }

    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, keyBytes]),
      format: 'der',
      type: 'spki'
    })
  }
}

function formatManifestIssues(issues: readonly { path: string; message: string }[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}

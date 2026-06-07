import { Buffer } from 'node:buffer'
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as signPayload,
  verify as verifyPayload
} from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import {
  createExtensionRegistryArtifactSignaturePayload,
  EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND,
  EXTENSION_REGISTRY_SCHEMA_VERSION,
  matchesExtensionRegistryArtifactTargetFormat,
  type ExtensionRegistryArtifact,
  type ExtensionRegistryArtifactSignature,
  type ExtensionRegistryArtifactSignaturePayload,
  type ExtensionRegistryArtifactTarget,
  type ExtensionRegistryRelease,
  type ExtensionRegistrySigningKey
} from '@kisaki3/extension-registry'
import {
  createExtensionRegistrySignerFingerprint,
  stringifyExtensionRegistryCanonicalJson
} from '@kisaki3/extension-registry/node'
import { CliError } from './logger'

export const EXTENSION_SIGNING_KEY_FILE_KIND = 'kisaki-extension-signing-key'
export const EXTENSION_ARTIFACT_SIGNATURE_FILE_KIND = 'kisaki-extension-artifact-signature-file'

export interface ExtensionSigningKeyFile {
  kind: typeof EXTENSION_SIGNING_KEY_FILE_KIND
  schemaVersion: typeof EXTENSION_REGISTRY_SCHEMA_VERSION
  id: string
  algorithm: 'ed25519'
  publicKey: string
  privateKey: string
  fingerprint: string
  createdAt: string
}

export interface ExtensionArtifactSignatureFile {
  kind: typeof EXTENSION_ARTIFACT_SIGNATURE_FILE_KIND
  schemaVersion: typeof EXTENSION_REGISTRY_SCHEMA_VERSION
  keyId: string
  algorithm: 'ed25519'
  publicKey: string
  fingerprint: string
  payload: ExtensionRegistryArtifactSignaturePayload
  signature: string
}

export interface GenerateSigningKeyFileOptions {
  outFile: string
  keyId?: string
  force?: boolean
}

export interface GenerateSigningKeyFileResult {
  keyFilePath: string
  key: ExtensionSigningKeyFile
}

export interface SignKisxArtifactInput {
  archivePath: string
  manifest: ExtensionManifest
  size: number
  sha256: string
  keyPath: string
  target: ExtensionRegistryArtifactTarget
  outFile?: string
}

export interface SignKisxArtifactResult {
  signatureFilePath: string
  signatureFile: ExtensionArtifactSignatureFile
}

export interface VerifiedArtifactSignature {
  signingKey: ExtensionRegistrySigningKey
  artifactSignature: ExtensionRegistryArtifactSignature
  fingerprint: string
}

const ED25519_RAW_PUBLIC_KEY_BYTES = 32
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

export async function generateSigningKeyFile(
  options: GenerateSigningKeyFileOptions
): Promise<GenerateSigningKeyFileResult> {
  const keyFilePath = path.resolve(options.outFile)
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const publicKeyBytes = exportRawEd25519PublicKey(publicKey)
  const publicKeyBase64 = publicKeyBytes.toString('base64')
  const privateKeyBase64 = Buffer.from(
    privateKey.export({
      format: 'der',
      type: 'pkcs8'
    })
  ).toString('base64')
  const fingerprint = createExtensionRegistrySignerFingerprint(publicKeyBase64)
  const key: ExtensionSigningKeyFile = {
    kind: EXTENSION_SIGNING_KEY_FILE_KIND,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    id: options.keyId ?? `ed25519-${fingerprint.slice(0, 12)}`,
    algorithm: 'ed25519',
    publicKey: publicKeyBase64,
    privateKey: privateKeyBase64,
    fingerprint,
    createdAt: new Date().toISOString()
  }

  await writeJsonFile(keyFilePath, key, {
    ...(options.force === undefined ? {} : { overwrite: options.force }),
    mode: 0o600
  })
  return { keyFilePath, key }
}

export async function signKisxArtifact(
  input: SignKisxArtifactInput
): Promise<SignKisxArtifactResult> {
  const key = await readSigningKeyFile(input.keyPath)
  const payload = createArtifactSignaturePayload(input)
  const signature = signArtifactPayload(key, payload)
  const signatureFile: ExtensionArtifactSignatureFile = {
    kind: EXTENSION_ARTIFACT_SIGNATURE_FILE_KIND,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    keyId: key.id,
    algorithm: 'ed25519',
    publicKey: key.publicKey,
    fingerprint: key.fingerprint,
    payload,
    signature
  }
  const signatureFilePath = path.resolve(input.outFile ?? defaultSignaturePath(input.archivePath))

  verifyArtifactSignatureFile(signatureFile, payload)
  await writeJsonFile(signatureFilePath, signatureFile, { overwrite: true, mode: 0o644 })

  return { signatureFilePath, signatureFile }
}

export async function readArtifactSignatureFile(
  filePath: string
): Promise<ExtensionArtifactSignatureFile> {
  const resolvedFilePath = path.resolve(filePath)
  let raw: unknown

  try {
    raw = JSON.parse(await readFile(resolvedFilePath, 'utf-8'))
  } catch (error) {
    throw new CliError(
      `Could not read artifact signature file: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    )
  }

  return parseArtifactSignatureFile(raw, resolvedFilePath)
}

export function verifyArtifactSignatureForPackage(input: {
  signatureFile: ExtensionArtifactSignatureFile
  manifest: ExtensionManifest
  size: number
  sha256: string
  target: ExtensionRegistryArtifactTarget
}): VerifiedArtifactSignature {
  const expectedPayload = createArtifactSignaturePayload(input)
  verifyArtifactSignatureFile(input.signatureFile, expectedPayload)

  return {
    signingKey: {
      id: input.signatureFile.keyId,
      algorithm: 'ed25519',
      publicKey: input.signatureFile.publicKey
    },
    artifactSignature: {
      keyId: input.signatureFile.keyId,
      algorithm: 'ed25519',
      value: input.signatureFile.signature
    },
    fingerprint: input.signatureFile.fingerprint
  }
}

export function verifyRegistryArtifactSignature(input: {
  packageId: string
  release: Pick<ExtensionRegistryRelease, 'version' | 'engines'>
  artifact: Pick<ExtensionRegistryArtifact, 'target' | 'size' | 'sha256' | 'signature'>
  signingKey: ExtensionRegistrySigningKey
}): void {
  const signature = input.artifact.signature
  if (!signature) {
    throw new CliError('Artifact is unsigned.')
  }

  if (signature.keyId !== input.signingKey.id) {
    throw new CliError('Artifact signature keyId does not match the referenced signing key.')
  }

  if (signature.algorithm !== input.signingKey.algorithm) {
    throw new CliError('Artifact signature algorithm does not match the referenced signing key.')
  }

  const payload = createExtensionRegistryArtifactSignaturePayload(
    input.packageId,
    input.release,
    input.artifact
  )
  verifyArtifactSignaturePayload(input.signingKey.publicKey, signature.value, payload)
}

function createArtifactSignaturePayload(input: {
  manifest: ExtensionManifest
  size: number
  sha256: string
  target: ExtensionRegistryArtifactTarget
}): ExtensionRegistryArtifactSignaturePayload {
  const kisakiRange = input.manifest.engines.kisaki.trim()
  if (!kisakiRange) {
    throw new CliError(
      'manifest.json must include engines.kisaki Extension API range before the package can be signed or published.'
    )
  }

  if (!matchesExtensionRegistryArtifactTargetFormat(input.target)) {
    throw new CliError(
      'Artifact target must be "any" or a platform-architecture pair such as "win32-x64".'
    )
  }

  return createExtensionRegistryArtifactSignaturePayload(
    input.manifest.id,
    {
      version: input.manifest.version,
      engines: {
        kisaki: kisakiRange
      }
    },
    {
      target: input.target,
      size: input.size,
      sha256: input.sha256
    }
  )
}

async function readSigningKeyFile(filePath: string): Promise<ExtensionSigningKeyFile> {
  const resolvedFilePath = path.resolve(filePath)
  let raw: unknown

  try {
    raw = JSON.parse(await readFile(resolvedFilePath, 'utf-8'))
  } catch (error) {
    throw new CliError(
      `Could not read signing key file: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }

  const key = parseSigningKeyFile(raw, resolvedFilePath)
  assertSigningKeyPair(key)
  return key
}

function parseSigningKeyFile(value: unknown, filePath: string): ExtensionSigningKeyFile {
  const record = requireRecord(value, filePath)
  const key: ExtensionSigningKeyFile = {
    kind: requireSigningKeyKind(record, filePath),
    schemaVersion: requireSchemaVersion(record, filePath),
    id: requireString(record, 'id', filePath),
    algorithm: requireAlgorithm(record, filePath),
    publicKey: requireBase64(record, 'publicKey', filePath),
    privateKey: requireBase64(record, 'privateKey', filePath),
    fingerprint: requireString(record, 'fingerprint', filePath),
    createdAt: requireString(record, 'createdAt', filePath)
  }

  const fingerprint = createExtensionRegistrySignerFingerprint(key.publicKey)
  if (key.fingerprint !== fingerprint) {
    throw new CliError(`${filePath}: signing key fingerprint does not match publicKey.`)
  }

  return key
}

function parseArtifactSignatureFile(
  value: unknown,
  filePath: string
): ExtensionArtifactSignatureFile {
  const record = requireRecord(value, filePath)
  const signatureFile: ExtensionArtifactSignatureFile = {
    kind: requireArtifactSignatureFileKind(record, filePath),
    schemaVersion: requireSchemaVersion(record, filePath),
    keyId: requireString(record, 'keyId', filePath),
    algorithm: requireAlgorithm(record, filePath),
    publicKey: requireBase64(record, 'publicKey', filePath),
    fingerprint: requireString(record, 'fingerprint', filePath),
    payload: parseArtifactSignaturePayload(record.payload, filePath),
    signature: requireBase64(record, 'signature', filePath)
  }

  const fingerprint = createExtensionRegistrySignerFingerprint(signatureFile.publicKey)
  if (signatureFile.fingerprint !== fingerprint) {
    throw new CliError(`${filePath}: artifact signature fingerprint does not match publicKey.`)
  }

  return signatureFile
}

function parseArtifactSignaturePayload(
  value: unknown,
  filePath: string
): ExtensionRegistryArtifactSignaturePayload {
  const record = requireRecord(value, `${filePath}: payload`)
  const engines = requireRecord(record.engines, `${filePath}: payload.engines`)
  const payload: ExtensionRegistryArtifactSignaturePayload = {
    kind: requireArtifactSignaturePayloadKind(record, `${filePath}: payload`),
    schemaVersion: requireSchemaVersion(record, `${filePath}: payload`),
    extensionId: requireString(record, 'extensionId', `${filePath}: payload`),
    version: requireString(record, 'version', `${filePath}: payload`),
    engines: {
      kisaki: requireString(engines, 'kisaki', `${filePath}: payload.engines`)
    },
    target: requireString(
      record,
      'target',
      `${filePath}: payload`
    ) as ExtensionRegistryArtifactTarget,
    size: requirePositiveInteger(record, 'size', `${filePath}: payload`),
    sha256: requireString(record, 'sha256', `${filePath}: payload`)
  }

  return payload
}

function signArtifactPayload(
  key: ExtensionSigningKeyFile,
  payload: ExtensionRegistryArtifactSignaturePayload
): string {
  const payloadBytes = Buffer.from(stringifyExtensionRegistryCanonicalJson(payload), 'utf-8')
  const privateKey = createPrivateKey({
    key: Buffer.from(key.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8'
  })

  return signPayload(null, payloadBytes, privateKey).toString('base64')
}

function verifyArtifactSignatureFile(
  signatureFile: ExtensionArtifactSignatureFile,
  expectedPayload: ExtensionRegistryArtifactSignaturePayload
): void {
  const actualPayloadJson = stringifyExtensionRegistryCanonicalJson(signatureFile.payload)
  const expectedPayloadJson = stringifyExtensionRegistryCanonicalJson(expectedPayload)

  if (actualPayloadJson !== expectedPayloadJson) {
    throw new CliError('Artifact signature payload does not match the package release fields.')
  }

  verifyArtifactSignaturePayload(signatureFile.publicKey, signatureFile.signature, expectedPayload)
}

function verifyArtifactSignaturePayload(
  publicKeyBase64: string,
  signatureBase64: string,
  expectedPayload: ExtensionRegistryArtifactSignaturePayload
): void {
  const publicKey = createEd25519PublicKey(publicKeyBase64)
  const payloadBytes = Buffer.from(
    stringifyExtensionRegistryCanonicalJson(expectedPayload),
    'utf-8'
  )
  const signatureBytes = Buffer.from(signatureBase64, 'base64')

  if (!verifyPayload(null, payloadBytes, publicKey, signatureBytes)) {
    throw new CliError('Artifact signature verification failed.')
  }
}

function assertSigningKeyPair(key: ExtensionSigningKeyFile): void {
  const privateKey = createPrivateKey({
    key: Buffer.from(key.privateKey, 'base64'),
    format: 'der',
    type: 'pkcs8'
  })
  const publicKey = createEd25519PublicKey(key.publicKey)
  const challenge = Buffer.from(EXTENSION_SIGNING_KEY_FILE_KIND, 'utf-8')
  const signature = signPayload(null, challenge, privateKey)

  if (!verifyPayload(null, challenge, publicKey, signature)) {
    throw new CliError('Signing key privateKey does not match publicKey.')
  }
}

function exportRawEd25519PublicKey(publicKey: ReturnType<typeof createPublicKey>): Buffer {
  const spki = Buffer.from(
    publicKey.export({
      format: 'der',
      type: 'spki'
    })
  )

  if (!spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    throw new CliError('Generated Ed25519 public key has an unsupported DER shape.')
  }

  return spki.subarray(ED25519_SPKI_PREFIX.length)
}

function createEd25519PublicKey(publicKey: string): ReturnType<typeof createPublicKey> {
  const publicKeyBytes = Buffer.from(publicKey, 'base64')

  try {
    return createPublicKey({
      key: publicKeyBytes,
      format: 'der',
      type: 'spki'
    })
  } catch {
    if (publicKeyBytes.length !== ED25519_RAW_PUBLIC_KEY_BYTES) {
      throw new CliError('Ed25519 public key must be a raw 32-byte key or SPKI DER.')
    }

    return createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBytes]),
      format: 'der',
      type: 'spki'
    })
  }
}

async function writeJsonFile(
  filePath: string,
  value: unknown,
  options: { overwrite?: boolean; mode: number }
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })

  try {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf-8',
      flag: options.overwrite ? 'w' : 'wx',
      mode: options.mode
    })
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new CliError(`File already exists: ${filePath}`)
    }

    throw error
  }
}

function defaultSignaturePath(archivePath: string): string {
  return archivePath.toLowerCase().endsWith('.kisx')
    ? `${archivePath.slice(0, -5)}.sig`
    : `${archivePath}.sig`
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CliError(`${label}: expected a JSON object.`)
  }

  return value as Record<string, unknown>
}

function requireString(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CliError(`${label}: ${field} must be a non-empty string.`)
  }

  return value
}

function requireBase64(record: Record<string, unknown>, field: string, label: string): string {
  const value = requireString(record, field, label)
  if (!BASE64_PATTERN.test(value)) {
    throw new CliError(`${label}: ${field} must be a base64 string.`)
  }

  return value
}

function requireSchemaVersion(
  record: Record<string, unknown>,
  label: string
): typeof EXTENSION_REGISTRY_SCHEMA_VERSION {
  if (record.schemaVersion !== EXTENSION_REGISTRY_SCHEMA_VERSION) {
    throw new CliError(`${label}: schemaVersion must be ${EXTENSION_REGISTRY_SCHEMA_VERSION}.`)
  }

  return EXTENSION_REGISTRY_SCHEMA_VERSION
}

function requireAlgorithm(record: Record<string, unknown>, label: string): 'ed25519' {
  if (record.algorithm !== 'ed25519') {
    throw new CliError(`${label}: algorithm must be ed25519.`)
  }

  return 'ed25519'
}

function requireSigningKeyKind(
  record: Record<string, unknown>,
  label: string
): typeof EXTENSION_SIGNING_KEY_FILE_KIND {
  if (record.kind !== EXTENSION_SIGNING_KEY_FILE_KIND) {
    throw new CliError(`${label}: signing key kind is invalid.`)
  }

  return EXTENSION_SIGNING_KEY_FILE_KIND
}

function requireArtifactSignatureFileKind(
  record: Record<string, unknown>,
  label: string
): typeof EXTENSION_ARTIFACT_SIGNATURE_FILE_KIND {
  if (record.kind !== EXTENSION_ARTIFACT_SIGNATURE_FILE_KIND) {
    throw new CliError(`${label}: artifact signature kind is invalid.`)
  }

  return EXTENSION_ARTIFACT_SIGNATURE_FILE_KIND
}

function requireArtifactSignaturePayloadKind(
  record: Record<string, unknown>,
  label: string
): typeof EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND {
  if (record.kind !== EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND) {
    throw new CliError(`${label}: artifact signature payload kind is invalid.`)
  }

  return EXTENSION_REGISTRY_ARTIFACT_SIGNATURE_KIND
}

function requirePositiveInteger(
  record: Record<string, unknown>,
  field: string,
  label: string
): number {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new CliError(`${label}: ${field} must be a positive integer.`)
  }

  return value
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

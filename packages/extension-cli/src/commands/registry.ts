import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import semver from 'semver'
import type { ExtensionManifest } from '@kisaki3/extension-api'
import {
  EXTENSION_REGISTRY_SCHEMA_URL,
  EXTENSION_REGISTRY_SCHEMA_VERSION,
  parseExtensionRegistryManifest,
  type ExtensionRegistryArtifact,
  type ExtensionRegistryArtifactTarget,
  type ExtensionRegistryManifest,
  type ExtensionRegistryPackage,
  type ExtensionRegistryRelease,
  type ExtensionRegistrySigningKey
} from '@kisaki3/extension-registry'
import { createExtensionRegistryReleaseDigest } from '@kisaki3/extension-registry/node'
import { CliError, logger } from '../logger'
import { inspectKisxPackage } from '../package-info'
import { readJsonFile } from '../project'
import {
  readArtifactSignatureFile,
  signKisxArtifact,
  type VerifiedArtifactSignature,
  verifyArtifactSignatureForPackage,
  verifyRegistryArtifactSignature
} from '../signing'

export interface RegistryInitCommandOptions {
  out: string
  id: string
  name: string
  description?: string
  homepage?: string
  force?: boolean
}

export interface RegistryValidateCommandOptions {
  allowInsecureLocalUrls?: boolean
}

export interface RegistryAddReleaseCommandOptions {
  manifest?: string
  url?: string
  signature?: string
  target: ExtensionRegistryArtifactTarget
  publishedAt?: string
  changelog?: string
  changelogUrl?: string
  replace?: boolean
  allowInsecureLocalUrls?: boolean
}

export interface RegistrySignCommandOptions {
  key?: string
  out?: string
  target: ExtensionRegistryArtifactTarget
}

const DEFAULT_REGISTRY_MANIFEST_PATH = 'registry/manifest.json'
export { DEFAULT_REGISTRY_MANIFEST_PATH }

export async function registryInitCommand(options: RegistryInitCommandOptions): Promise<void> {
  logger.heading('kisx registry init', 'Creating registry manifest.')

  const manifest = compactRegistryManifest({
    $schema: EXTENSION_REGISTRY_SCHEMA_URL,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    id: options.id,
    name: options.name,
    description: options.description,
    homepage: options.homepage,
    updatedAt: new Date().toISOString(),
    signingKeys: [],
    packages: []
  })
  assertRegistryManifestValid(manifest)

  const manifestPath = path.resolve(options.out)
  await writeJsonDocument(manifestPath, manifest, {
    ...(options.force === undefined ? {} : { overwrite: options.force })
  })
  logger.success(`Created ${manifestPath}`)
}

export async function registryValidateCommand(
  manifestPath: string,
  options: RegistryValidateCommandOptions
): Promise<void> {
  logger.heading('kisx registry validate', 'Validating registry manifest.')
  const manifest = await readRegistryManifestFile(manifestPath, options)

  logger.success('Registry manifest is valid.')
  logger.detail(`Packages: ${manifest.packages.length}`)
  logger.detail(`Signing keys: ${manifest.signingKeys.length}`)
  logger.detail(`Signed artifacts: ${countSignedArtifacts(manifest)}`)
}

export async function registryAddReleaseCommand(
  packagePath: string,
  options: RegistryAddReleaseCommandOptions
): Promise<void> {
  if (!options.manifest) {
    throw new CliError('Missing --manifest <manifest>.')
  }

  if (!options.url) {
    throw new CliError('Missing --url <artifact-url>.')
  }

  logger.heading('kisx registry add-release', 'Updating registry manifest.')
  const [registryManifest, packageInfo] = await Promise.all([
    readRegistryManifestFile(options.manifest, options),
    inspectKisxPackage(packagePath)
  ])
  let artifact: ExtensionRegistryArtifact = {
    target: options.target,
    url: options.url,
    size: packageInfo.size,
    sha256: packageInfo.sha256
  }
  const verifiedSignature = await readVerifiedSignature({
    ...(options.signature === undefined ? {} : { signaturePath: options.signature }),
    manifest: packageInfo.manifest,
    target: options.target,
    size: packageInfo.size,
    sha256: packageInfo.sha256
  })
  if (verifiedSignature) {
    artifact = {
      ...artifact,
      signature: verifiedSignature.artifactSignature
    }
  }
  const signingKey = verifiedSignature?.signingKey ?? null
  const release = createRegistryRelease(packageInfo.manifest, artifact, options)
  const updatedManifest = upsertRegistryRelease({
    manifest: registryManifest,
    extensionManifest: packageInfo.manifest,
    release,
    signingKey,
    ...(options.replace === undefined ? {} : { replace: options.replace })
  })

  assertRegistryManifestValid(updatedManifest, options)
  const updatedPackage = requireRegistryPackage(updatedManifest, packageInfo.manifest.id)
  const updatedRelease = requireRegistryRelease(updatedPackage, packageInfo.manifest.version)
  const releaseDigest = createExtensionRegistryReleaseDigest(
    updatedManifest,
    updatedPackage,
    updatedRelease
  )

  await writeJsonDocument(path.resolve(options.manifest), updatedManifest, { overwrite: true })
  logger.success(
    `Added ${packageInfo.manifest.id}@${packageInfo.manifest.version} (${options.target}) to ${path.resolve(options.manifest)}`
  )
  logger.detail(`Artifact size: ${packageInfo.size}`)
  logger.detail(`Artifact sha256: ${packageInfo.sha256}`)
  logger.detail(`Release digest: ${releaseDigest}`)
  if (signingKey) {
    logger.detail(`Signing key: ${signingKey.id}`)
  }
}

export async function registryDigestCommand(packagePath: string): Promise<void> {
  logger.heading('kisx registry digest', 'Calculating package digest.')
  const packageInfo = await inspectKisxPackage(packagePath)

  logger.success(`${packageInfo.manifest.id}@${packageInfo.manifest.version}`)
  logger.detail(`Package: ${packageInfo.archivePath}`)
  logger.detail(`Size: ${packageInfo.size}`)
  logger.detail(`sha256: ${packageInfo.sha256}`)
}

export async function registrySignCommand(
  packagePath: string,
  options: RegistrySignCommandOptions
): Promise<void> {
  if (!options.key) {
    throw new CliError('Missing --key <key-file>.')
  }

  logger.heading('kisx registry sign', 'Signing package artifact identity.')
  const packageInfo = await inspectKisxPackage(packagePath)
  const result = await signKisxArtifact({
    archivePath: packageInfo.archivePath,
    manifest: packageInfo.manifest,
    size: packageInfo.size,
    sha256: packageInfo.sha256,
    keyPath: options.key,
    target: options.target,
    ...(options.out === undefined ? {} : { outFile: options.out })
  })

  logger.success(`Created ${result.signatureFilePath}`)
  logger.detail(`Key id: ${result.signatureFile.keyId}`)
  logger.detail(`Fingerprint: ${result.signatureFile.fingerprint}`)
}

async function readVerifiedSignature(input: {
  signaturePath?: string
  manifest: ExtensionManifest
  target: ExtensionRegistryArtifactTarget
  size: number
  sha256: string
}): Promise<VerifiedArtifactSignature | null> {
  if (!input.signaturePath) {
    return null
  }

  const signatureFile = await readArtifactSignatureFile(input.signaturePath)
  const verified = verifyArtifactSignatureForPackage({
    signatureFile,
    manifest: input.manifest,
    size: input.size,
    sha256: input.sha256,
    target: input.target
  })

  logger.detail(`Verified signature fingerprint: ${verified.fingerprint}`)
  return verified
}

function createRegistryRelease(
  manifest: ExtensionManifest,
  artifact: ExtensionRegistryArtifact,
  options: RegistryAddReleaseCommandOptions
): ExtensionRegistryRelease {
  const kisakiRange = manifest.engines.kisaki.trim()
  if (!kisakiRange) {
    throw new CliError(
      'manifest.json must include engines.kisaki Extension API range before publishing a release.'
    )
  }

  return compactRegistryRelease({
    version: manifest.version,
    publishedAt: options.publishedAt ?? new Date().toISOString(),
    engines: {
      kisaki: kisakiRange
    },
    changelog:
      options.changelog || options.changelogUrl
        ? {
            text: options.changelog,
            url: options.changelogUrl
          }
        : undefined,
    artifacts: [artifact]
  })
}

function upsertRegistryRelease(input: {
  manifest: ExtensionRegistryManifest
  extensionManifest: ExtensionManifest
  release: ExtensionRegistryRelease
  signingKey: ExtensionRegistrySigningKey | null
  replace?: boolean
}): ExtensionRegistryManifest {
  const signingKeys = input.signingKey
    ? mergeSigningKey(input.manifest.signingKeys, input.signingKey)
    : [...input.manifest.signingKeys]
  const packages = [...input.manifest.packages]
  const packageIndex = packages.findIndex((registryPackage) => {
    return registryPackage.id === input.extensionManifest.id
  })
  const existingPackage =
    packageIndex >= 0 ? packages[packageIndex] : createRegistryPackage(input.extensionManifest)
  const releaseIndex = existingPackage.releases.findIndex((release) => {
    return isSameReleaseVersion(release, input.release)
  })

  if (!areCategorySetsEqual(existingPackage.categories, input.extensionManifest.categories)) {
    throw new CliError(
      `Existing package "${existingPackage.id}" has different categories than the .kisx manifest.`
    )
  }

  const updatedRelease =
    releaseIndex >= 0
      ? mergeRegistryRelease({
          packageId: existingPackage.id,
          existing: existingPackage.releases[releaseIndex],
          incoming: input.release,
          ...(input.replace === undefined ? {} : { replace: input.replace })
        })
      : input.release
  const releases =
    releaseIndex >= 0
      ? existingPackage.releases.map((release, index) =>
          index === releaseIndex ? updatedRelease : release
        )
      : existingPackage.releases.concat(updatedRelease)
  const updatedPackage = {
    ...existingPackage,
    releases: releases.toSorted(compareRegistryReleases)
  }

  if (packageIndex >= 0) {
    packages[packageIndex] = updatedPackage
  } else {
    packages.push(updatedPackage)
  }

  const candidateManifest = sortRegistryManifest({
    ...input.manifest,
    updatedAt: input.manifest.updatedAt,
    signingKeys,
    packages
  })

  if (areRegistryManifestsEquivalent(input.manifest, candidateManifest)) {
    return input.manifest
  }

  return {
    ...candidateManifest,
    updatedAt: new Date().toISOString()
  }
}

function createRegistryPackage(manifest: ExtensionManifest): ExtensionRegistryPackage {
  return compactRegistryPackage({
    id: manifest.id,
    name: manifest.name,
    summary: createPackageSummary(manifest),
    description: manifest.description,
    categories: manifest.categories,
    keywords: manifest.keywords,
    owner: manifest.author
      ? {
          name: manifest.author
        }
      : undefined,
    homepage: manifest.homepage,
    releases: []
  })
}

function mergeRegistryRelease(input: {
  packageId: string
  existing: ExtensionRegistryRelease
  incoming: ExtensionRegistryRelease
  replace?: boolean
}): ExtensionRegistryRelease {
  const existingEngine = input.existing.engines.kisaki.trim()
  const incomingEngine = input.incoming.engines.kisaki.trim()
  if (existingEngine !== incomingEngine) {
    throw new CliError(
      `${input.packageId}@${input.incoming.version} already exists with a different engines.kisaki range. Publish a new semver version.`
    )
  }

  const incomingArtifact = input.incoming.artifacts[0]
  const artifactIndex = input.existing.artifacts.findIndex((artifact) => {
    return artifact.target === incomingArtifact.target
  })

  if (artifactIndex >= 0) {
    const existingArtifact = input.existing.artifacts[artifactIndex]
    const changelogChanged =
      input.incoming.changelog !== undefined &&
      JSON.stringify(input.incoming.changelog) !== JSON.stringify(input.existing.changelog)

    if (areRegistryArtifactsEqual(existingArtifact, incomingArtifact) && !changelogChanged) {
      return input.existing
    }

    if (!input.replace) {
      throw new CliError(
        `${input.packageId}@${input.incoming.version} already has artifact target "${incomingArtifact.target}". Use --replace to overwrite it.`
      )
    }
  }

  const artifacts =
    artifactIndex >= 0
      ? input.existing.artifacts.map((artifact, index) =>
          index === artifactIndex ? incomingArtifact : artifact
        )
      : input.existing.artifacts.concat(incomingArtifact)

  return compactRegistryRelease({
    ...input.existing,
    publishedAt: input.replace ? input.incoming.publishedAt : input.existing.publishedAt,
    changelog: input.incoming.changelog ?? input.existing.changelog,
    artifacts: artifacts.toSorted(compareRegistryArtifacts)
  })
}

function mergeSigningKey(
  signingKeys: readonly ExtensionRegistrySigningKey[],
  signingKey: ExtensionRegistrySigningKey
): ExtensionRegistrySigningKey[] {
  const existing = signingKeys.find((candidate) => candidate.id === signingKey.id)

  if (!existing) {
    return [...signingKeys, signingKey].toSorted(compareSigningKeys)
  }

  if (existing.algorithm !== signingKey.algorithm || existing.publicKey !== signingKey.publicKey) {
    throw new CliError(`Signing key id "${signingKey.id}" already exists with different key data.`)
  }

  return [...signingKeys].toSorted(compareSigningKeys)
}

async function readRegistryManifestFile(
  manifestPath: string,
  options: RegistryValidateCommandOptions = {}
): Promise<ExtensionRegistryManifest> {
  const resolvedManifestPath = path.resolve(manifestPath)
  let raw: unknown

  try {
    raw = await readJsonFile(resolvedManifestPath)
  } catch (error) {
    throw new CliError(
      `Could not read registry manifest: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    )
  }

  const parsed = parseExtensionRegistryManifest(raw, {
    ...(options.allowInsecureLocalUrls === undefined
      ? {}
      : { allowInsecureLocalUrls: options.allowInsecureLocalUrls })
  })

  if (!parsed.manifest) {
    throw new CliError(formatIssues('Registry manifest is invalid.', parsed.issues))
  }

  assertRegistryArtifactSignaturesValid(parsed.manifest)
  return parsed.manifest
}

function assertRegistryManifestValid(
  manifest: ExtensionRegistryManifest,
  options: RegistryValidateCommandOptions = {}
): void {
  const parsed = parseExtensionRegistryManifest(manifest, {
    ...(options.allowInsecureLocalUrls === undefined
      ? {}
      : { allowInsecureLocalUrls: options.allowInsecureLocalUrls })
  })

  if (!parsed.manifest) {
    throw new CliError(formatIssues('Registry manifest is invalid.', parsed.issues))
  }

  assertRegistryArtifactSignaturesValid(parsed.manifest)
}

function requireRegistryPackage(
  manifest: ExtensionRegistryManifest,
  extensionId: string
): ExtensionRegistryPackage {
  const registryPackage = manifest.packages.find((candidate) => candidate.id === extensionId)

  if (!registryPackage) {
    throw new CliError(`Package "${extensionId}" was not written to the registry manifest.`)
  }

  return registryPackage
}

function requireRegistryRelease(
  registryPackage: ExtensionRegistryPackage,
  version: string
): ExtensionRegistryRelease {
  const release = registryPackage.releases.find((candidate) => {
    return candidate.version === version
  })

  if (!release) {
    throw new CliError(
      `Release "${registryPackage.id}@${version}" was not written to the registry manifest.`
    )
  }

  return release
}

function assertRegistryArtifactSignaturesValid(manifest: ExtensionRegistryManifest): void {
  const signingKeys = new Map(manifest.signingKeys.map((key) => [key.id, key]))
  const issues: { path: string; message: string }[] = []

  for (const [packageIndex, registryPackage] of manifest.packages.entries()) {
    for (const [releaseIndex, release] of registryPackage.releases.entries()) {
      for (const [artifactIndex, artifact] of release.artifacts.entries()) {
        if (!artifact.signature) {
          continue
        }

        const signingKey = signingKeys.get(artifact.signature.keyId)
        if (!signingKey) {
          continue
        }

        try {
          verifyRegistryArtifactSignature({
            packageId: registryPackage.id,
            release,
            artifact,
            signingKey
          })
        } catch (error) {
          issues.push({
            path: `$.packages[${packageIndex}].releases[${releaseIndex}].artifacts[${artifactIndex}].signature`,
            message: error instanceof Error ? error.message : 'Artifact signature is invalid.'
          })
        }
      }
    }
  }

  if (issues.length > 0) {
    throw new CliError(formatIssues('Registry artifact signatures are invalid.', issues))
  }
}

async function writeJsonDocument(
  filePath: string,
  value: unknown,
  options: { overwrite?: boolean }
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })

  try {
    await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf-8',
      flag: options.overwrite ? 'w' : 'wx'
    })
  } catch (error) {
    if (isNodeError(error) && error.code === 'EEXIST') {
      throw new CliError(`File already exists: ${filePath}`)
    }

    throw error
  }
}

function compactRegistryManifest(manifest: unknown): ExtensionRegistryManifest {
  return removeUndefined(manifest) as ExtensionRegistryManifest
}

function compactRegistryPackage(registryPackage: unknown): ExtensionRegistryPackage {
  return removeUndefined(registryPackage) as ExtensionRegistryPackage
}

function compactRegistryRelease(release: unknown): ExtensionRegistryRelease {
  return removeUndefined(release) as ExtensionRegistryRelease
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

function sortRegistryManifest(manifest: ExtensionRegistryManifest): ExtensionRegistryManifest {
  return {
    ...manifest,
    signingKeys: [...manifest.signingKeys].toSorted(compareSigningKeys),
    packages: manifest.packages
      .map((registryPackage) => ({
        ...registryPackage,
        releases: registryPackage.releases
          .map((release) => ({
            ...release,
            artifacts: [...release.artifacts].toSorted(compareRegistryArtifacts)
          }))
          .toSorted(compareRegistryReleases)
      }))
      .toSorted(compareRegistryPackages)
  }
}

function countSignedArtifacts(manifest: ExtensionRegistryManifest): number {
  return manifest.packages.reduce((packageTotal, registryPackage) => {
    return (
      packageTotal +
      registryPackage.releases.reduce((releaseTotal, release) => {
        return releaseTotal + release.artifacts.filter((artifact) => artifact.signature).length
      }, 0)
    )
  }, 0)
}

function createPackageSummary(manifest: ExtensionManifest): string {
  const description = manifest.description?.trim()
  if (!description) {
    return manifest.name
  }

  return description.length > 160 ? `${description.slice(0, 157)}...` : description
}

function compareRegistryPackages(
  left: ExtensionRegistryPackage,
  right: ExtensionRegistryPackage
): number {
  return compareStrings(left.id, right.id)
}

function compareRegistryReleases(
  left: ExtensionRegistryRelease,
  right: ExtensionRegistryRelease
): number {
  return semver.rcompare(left.version, right.version) || compareStrings(left.version, right.version)
}

function compareRegistryArtifacts(
  left: ExtensionRegistryArtifact,
  right: ExtensionRegistryArtifact
): number {
  return compareStrings(left.target, right.target) || compareStrings(left.sha256, right.sha256)
}

function compareSigningKeys(
  left: ExtensionRegistrySigningKey,
  right: ExtensionRegistrySigningKey
): number {
  return compareStrings(left.id, right.id)
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

function areCategorySetsEqual(left: readonly string[], right: readonly string[]): boolean {
  return [...new Set(left)].toSorted().join('\0') === [...new Set(right)].toSorted().join('\0')
}

function areRegistryArtifactsEqual(
  left: ExtensionRegistryArtifact,
  right: ExtensionRegistryArtifact
): boolean {
  return (
    left.target === right.target &&
    left.url === right.url &&
    left.size === right.size &&
    left.sha256 === right.sha256 &&
    JSON.stringify(left.signature) === JSON.stringify(right.signature)
  )
}

function areRegistryManifestsEquivalent(
  left: ExtensionRegistryManifest,
  right: ExtensionRegistryManifest
): boolean {
  const comparableLeft = sortRegistryManifest({ ...left, updatedAt: '' })
  const comparableRight = sortRegistryManifest({ ...right, updatedAt: '' })

  return JSON.stringify(comparableLeft) === JSON.stringify(comparableRight)
}

function isSameReleaseVersion(
  left: Pick<ExtensionRegistryRelease, 'version'>,
  right: Pick<ExtensionRegistryRelease, 'version'>
): boolean {
  return left.version === right.version
}

function formatIssues(title: string, issues: readonly { path: string; message: string }[]): string {
  return [title, ...issues.map((issue) => `${issue.path}: ${issue.message}`)].join('\n')
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

import semver from 'semver'
import { isExtensionCategory, validateExtensionIdentifier } from '@kisaki3/extension-api'
import type { ValidationIssue } from '../shared/validation'
import {
  isPlainObject,
  validateOptionalString,
  validateRequiredArray,
  validateRequiredEnumString,
  validateRequiredString,
  validateUnknownKeys
} from '../shared/validation'
import type { ExtensionRegistryArtifactTarget } from './artifact'
import type { ExtensionRegistryManifest } from './manifest'
import {
  EXTENSION_REGISTRY_PREVIEW_RELEASE_PREFIXES,
  EXTENSION_REGISTRY_SCHEMA_VERSION,
  EXTENSION_REGISTRY_SIGNING_ALGORITHMS
} from './manifest'
import { getExtensionRegistryPreviewReleasePrefix } from './release'

export interface ExtensionRegistryManifestValidationOptions {
  allowInsecureLocalUrls?: boolean
}

export interface ParsedExtensionRegistryManifest {
  manifest: ExtensionRegistryManifest | null
  issues: ValidationIssue[]
}

const MANIFEST_KEYS = new Set([
  '$schema',
  'schemaVersion',
  'id',
  'name',
  'description',
  'homepage',
  'updatedAt',
  'signingKeys',
  'packages'
])
const SIGNING_KEY_KEYS = new Set(['id', 'algorithm', 'publicKey'])
const PACKAGE_KEYS = new Set([
  'id',
  'name',
  'description',
  'categories',
  'keywords',
  'owner',
  'homepage',
  'repository',
  'license',
  'icon',
  'releases'
])
const OWNER_KEYS = new Set(['name', 'url'])
const ICON_KEYS = new Set(['url', 'sha256'])
const RELEASE_KEYS = new Set([
  'version',
  'publishedAt',
  'engines',
  'releasePage',
  'changelog',
  'yanked',
  'artifacts'
])
const RELEASE_ENGINES_KEYS = new Set(['kisakiExtensionApi'])
const LOCALIZED_DOCUMENT_SET_KEYS = new Set(['defaultLocale', 'locales'])
const LOCALIZED_DOCUMENT_KEYS = new Set(['summary', 'body'])
const YANK_KEYS = new Set(['at', 'reason'])
const ARTIFACT_KEYS = new Set(['target', 'url', 'size', 'sha256', 'signature'])
const SIGNATURE_KEYS = new Set(['keyId', 'algorithm', 'value'])

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/
const ARTIFACT_TARGET_PATTERN = /^(?:any|[a-z][a-z0-9]*-[a-z0-9][a-z0-9_-]*)$/
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const ISO_UTC_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/
const LOCALE_PATTERN = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/

export function matchesExtensionRegistryArtifactTargetFormat(
  value: string
): value is ExtensionRegistryArtifactTarget {
  return ARTIFACT_TARGET_PATTERN.test(value)
}

export function validateExtensionRegistryManifestShape(
  value: unknown,
  options: ExtensionRegistryManifestValidationOptions = {}
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Registry manifest must be a JSON object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(
      value,
      MANIFEST_KEYS,
      '$',
      'Unknown registry manifest field.'
    ),
    ...validateOptionalString(value.$schema, '$.$schema', {
      minLength: 1,
      typeMessage: 'Field must be a string when provided.',
      valueMessage: 'Field must be a non-empty string when provided.'
    }),
    ...validateRegistrySchemaVersion(value.schemaVersion, '$.schemaVersion'),
    ...validateExtensionIdentifier(value.id, '$.id'),
    ...validateRequiredString(value.name, '$.name', {
      minLength: 1,
      trim: true,
      valueMessage: 'Field must be a non-empty string.'
    }),
    ...validateOptionalString(value.description, '$.description', {
      typeMessage: 'Field must be a string when provided.'
    }),
    ...validateOptionalUri(value.homepage, '$.homepage'),
    ...validateRequiredIsoUtcString(value.updatedAt, '$.updatedAt')
  )

  const signingKeys = value.signingKeys
  issues.push(
    ...validateRequiredArray(signingKeys, '$.signingKeys', {
      typeMessage: 'signingKeys must be an array.'
    })
  )
  if (Array.isArray(signingKeys)) {
    const seenSigningKeys = new Set<string>()
    for (const [index, signingKey] of signingKeys.entries()) {
      issues.push(...validateSigningKey(signingKey, `$.signingKeys[${index}]`))
      issues.push(
        ...trackUniqueStringProperty(
          signingKey,
          'id',
          `$.signingKeys[${index}].id`,
          seenSigningKeys,
          'Duplicate signing key id.'
        )
      )
    }
  }

  const packages = value.packages
  issues.push(
    ...validateRequiredArray(packages, '$.packages', {
      typeMessage: 'packages must be an array.'
    })
  )
  if (Array.isArray(packages)) {
    const seenPackages = new Set<string>()
    for (const [index, registryPackage] of packages.entries()) {
      issues.push(...validateRegistryPackage(registryPackage, `$.packages[${index}]`, options))
      issues.push(
        ...trackUniqueStringProperty(
          registryPackage,
          'id',
          `$.packages[${index}].id`,
          seenPackages,
          'Duplicate package id.'
        )
      )
    }
  }

  return issues
}

export function validateExtensionRegistryManifestSemver(
  manifest: Pick<ExtensionRegistryManifest, 'packages'>
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const [packageIndex, registryPackage] of manifest.packages.entries()) {
    for (const [releaseIndex, release] of registryPackage.releases.entries()) {
      const releasePath = `$.packages[${packageIndex}].releases[${releaseIndex}]`

      const validVersion = semver.valid(release.version)
      if (!validVersion) {
        issues.push({
          path: `${releasePath}.version`,
          message: 'version must be a valid semver string.'
        })
      } else if (
        semver.prerelease(validVersion) &&
        !getExtensionRegistryPreviewReleasePrefix(validVersion)
      ) {
        issues.push({
          path: `${releasePath}.version`,
          message: `preview version must start with one of: ${EXTENSION_REGISTRY_PREVIEW_RELEASE_PREFIXES.join(
            ', '
          )}.`
        })
      }

      if (!semver.validRange(release.engines.kisakiExtensionApi)) {
        issues.push({
          path: `${releasePath}.engines.kisakiExtensionApi`,
          message: 'engines.kisakiExtensionApi must be a valid Extension API semver range.'
        })
      }
    }
  }

  return issues
}

export function validateExtensionRegistryManifestReferences(
  manifest: Pick<ExtensionRegistryManifest, 'signingKeys' | 'packages'>
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const signingKeyIds = new Set(manifest.signingKeys.map((key) => key.id))

  for (const [packageIndex, registryPackage] of manifest.packages.entries()) {
    for (const [releaseIndex, release] of registryPackage.releases.entries()) {
      for (const [artifactIndex, artifact] of release.artifacts.entries()) {
        if (artifact.signature && !signingKeyIds.has(artifact.signature.keyId)) {
          issues.push({
            path: `$.packages[${packageIndex}].releases[${releaseIndex}].artifacts[${artifactIndex}].signature.keyId`,
            message:
              'signature.keyId must reference a signing key declared by this registry manifest.'
          })
        }
      }
    }
  }

  return issues
}

export function parseExtensionRegistryManifest(
  value: unknown,
  options: ExtensionRegistryManifestValidationOptions = {}
): ParsedExtensionRegistryManifest {
  const issues = [...validateExtensionRegistryManifestShape(value, options)]

  if (issues.length > 0) {
    return { manifest: null, issues }
  }

  const manifest = value as ExtensionRegistryManifest
  issues.push(
    ...validateExtensionRegistryManifestSemver(manifest),
    ...validateExtensionRegistryManifestReferences(manifest)
  )

  if (issues.length > 0) {
    return { manifest: null, issues }
  }

  return { manifest, issues }
}

export function isExtensionRegistryManifest(value: unknown): value is ExtensionRegistryManifest {
  return parseExtensionRegistryManifest(value).issues.length === 0
}

function validateSigningKey(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'Signing key must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, SIGNING_KEY_KEYS, path, 'Unknown signing key field.'),
    ...validateRequiredString(value.id, `${path}.id`, {
      minLength: 1,
      trim: true,
      valueMessage: 'Signing key id must be a non-empty string.'
    }),
    ...validateRequiredEnumString(
      value.algorithm,
      `${path}.algorithm`,
      EXTENSION_REGISTRY_SIGNING_ALGORITHMS,
      'Signing key algorithm must be ed25519.'
    ),
    ...validateRequiredBase64(value.publicKey, `${path}.publicKey`, 'publicKey')
  )

  return issues
}

function validateRegistryPackage(
  value: unknown,
  path: string,
  options: ExtensionRegistryManifestValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'Package must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, PACKAGE_KEYS, path, 'Unknown package field.'),
    ...validateExtensionIdentifier(value.id, `${path}.id`),
    ...validateRequiredString(value.name, `${path}.name`, {
      minLength: 1,
      trim: true,
      valueMessage: 'Package name must be a non-empty string.'
    }),
    ...validateLocalizedDocumentSet(value.description, `${path}.description`, 'description'),
    ...validateOptionalUri(value.homepage, `${path}.homepage`),
    ...validateOptionalUri(value.repository, `${path}.repository`),
    ...validateOptionalString(value.license, `${path}.license`, {
      minLength: 1,
      trim: true,
      typeMessage: 'license must be a string when provided.',
      valueMessage: 'license must be a non-empty string when provided.'
    })
  )

  issues.push(...validatePackageCategories(value.categories, `${path}.categories`))
  issues.push(...validatePackageKeywords(value.keywords, `${path}.keywords`))

  if (value.owner !== undefined) {
    issues.push(...validatePackageOwner(value.owner, `${path}.owner`))
  }

  if (value.icon !== undefined) {
    issues.push(...validatePackageIcon(value.icon, `${path}.icon`, options))
  }

  const releases = value.releases
  issues.push(
    ...validateRequiredArray(releases, `${path}.releases`, {
      minLength: 1,
      typeMessage: 'releases must be an array.',
      valueMessage: 'releases must contain at least one item.'
    })
  )
  if (Array.isArray(releases)) {
    const seenReleaseVersions = new Set<string>()
    for (const [index, release] of releases.entries()) {
      const releasePath = `${path}.releases[${index}]`
      issues.push(...validateRelease(release, releasePath, options))
      issues.push(
        ...trackUniqueStringProperty(
          release,
          'version',
          `${releasePath}.version`,
          seenReleaseVersions,
          'Duplicate release version. Use semver prerelease identifiers for beta or nightly builds.'
        )
      )
    }
  }

  return issues
}

function validatePackageOwner(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'owner must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, OWNER_KEYS, path, 'Unknown owner field.'),
    ...validateRequiredString(value.name, `${path}.name`, {
      minLength: 1,
      trim: true,
      valueMessage: 'owner.name must be a non-empty string.'
    }),
    ...validateOptionalUri(value.url, `${path}.url`)
  )

  return issues
}

function validatePackageIcon(
  value: unknown,
  path: string,
  options: ExtensionRegistryManifestValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'icon must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, ICON_KEYS, path, 'Unknown icon field.'),
    ...validateRequiredSecureUrl(value.url, `${path}.url`, options, 'icon.url')
  )

  if (value.sha256 !== undefined) {
    issues.push(...validateSha256(value.sha256, `${path}.sha256`, 'icon.sha256'))
  }

  return issues
}

function validateRelease(
  value: unknown,
  path: string,
  options: ExtensionRegistryManifestValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'Release must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, RELEASE_KEYS, path, 'Unknown release field.'),
    ...validateRequiredString(value.version, `${path}.version`, {
      minLength: 1,
      trim: true,
      valueMessage: 'Release version must be a non-empty string.'
    }),
    ...validateRequiredIsoUtcString(value.publishedAt, `${path}.publishedAt`)
  )

  issues.push(...validateReleaseEngines(value.engines, `${path}.engines`))
  issues.push(...validateOptionalUri(value.releasePage, `${path}.releasePage`))

  if (value.changelog !== undefined) {
    issues.push(...validateLocalizedDocumentSet(value.changelog, `${path}.changelog`, 'changelog'))
  }
  if (value.yanked !== undefined) {
    issues.push(...validateReleaseYank(value.yanked, `${path}.yanked`))
  }

  const artifacts = value.artifacts
  issues.push(
    ...validateRequiredArray(artifacts, `${path}.artifacts`, {
      minLength: 1,
      typeMessage: 'artifacts must be an array.',
      valueMessage: 'artifacts must contain at least one item.'
    })
  )
  if (Array.isArray(artifacts)) {
    const seenArtifactTargets = new Set<string>()
    for (const [index, artifact] of artifacts.entries()) {
      const artifactPath = `${path}.artifacts[${index}]`
      issues.push(...validateArtifact(artifact, artifactPath, options))
      issues.push(
        ...trackUniqueStringProperty(
          artifact,
          'target',
          `${artifactPath}.target`,
          seenArtifactTargets,
          'Duplicate artifact target.'
        )
      )
    }
  }

  return issues
}

function validateReleaseEngines(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'engines must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(
      value,
      RELEASE_ENGINES_KEYS,
      path,
      'Unknown release engines field.'
    ),
    ...validateRequiredString(value.kisakiExtensionApi, `${path}.kisakiExtensionApi`, {
      minLength: 1,
      trim: true,
      valueMessage: 'engines.kisakiExtensionApi must be a non-empty string.'
    })
  )

  return issues
}

function validateLocalizedDocumentSet(
  value: unknown,
  path: string,
  label: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: `${label} must be a localized document set.` }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(
      value,
      LOCALIZED_DOCUMENT_SET_KEYS,
      path,
      `Unknown ${label} field.`
    ),
    ...validateRequiredString(value.defaultLocale, `${path}.defaultLocale`, {
      minLength: 1,
      trim: true,
      typeMessage: `${label}.defaultLocale must be a string.`,
      valueMessage: `${label}.defaultLocale must be a non-empty locale.`
    })
  )

  if (typeof value.defaultLocale === 'string' && !LOCALE_PATTERN.test(value.defaultLocale)) {
    issues.push({
      path: `${path}.defaultLocale`,
      message: `${label}.defaultLocale must be a BCP 47-style locale such as en or zh-Hans.`
    })
  }

  const locales = value.locales
  if (!isPlainObject(locales)) {
    issues.push({
      path: `${path}.locales`,
      message: `${label}.locales must be an object keyed by locale.`
    })
    return issues
  }

  const localeEntries = Object.entries(locales)
  if (localeEntries.length === 0) {
    issues.push({
      path: `${path}.locales`,
      message: `${label}.locales must contain at least one locale.`
    })
  }

  for (const [locale, document] of localeEntries) {
    const localePath = `${path}.locales.${JSON.stringify(locale)}`
    if (!LOCALE_PATTERN.test(locale)) {
      issues.push({
        path: localePath,
        message: `${label} locale keys must be BCP 47-style locales such as en or zh-Hans.`
      })
    }
    issues.push(...validateLocalizedDocument(document, localePath, label))
  }

  if (
    typeof value.defaultLocale === 'string' &&
    LOCALE_PATTERN.test(value.defaultLocale) &&
    !Object.prototype.hasOwnProperty.call(locales, value.defaultLocale)
  ) {
    issues.push({
      path: `${path}.defaultLocale`,
      message: `${label}.defaultLocale must reference an entry in ${label}.locales.`
    })
  }

  return issues
}

function validateLocalizedDocument(value: unknown, path: string, label: string): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path, message: `${label} locale entry must be an object.` }]
  }

  return [
    ...validateUnknownKeysWithMessage(
      value,
      LOCALIZED_DOCUMENT_KEYS,
      path,
      `Unknown ${label} locale field.`
    ),
    ...validateRequiredString(value.summary, `${path}.summary`, {
      minLength: 1,
      trim: true,
      typeMessage: `${label} summary must be a string.`,
      valueMessage: `${label} summary must be a non-empty string.`
    }),
    ...validateOptionalString(value.body, `${path}.body`, {
      minLength: 1,
      trim: true,
      typeMessage: `${label} body must be a string when provided.`,
      valueMessage: `${label} body must be a non-empty string when provided.`
    })
  ]
}

function validateReleaseYank(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'yanked must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, YANK_KEYS, path, 'Unknown yanked field.'),
    ...validateRequiredIsoUtcString(value.at, `${path}.at`)
  )

  if (value.reason !== undefined) {
    issues.push(
      ...validateOptionalString(value.reason, `${path}.reason`, {
        minLength: 1,
        trim: true,
        typeMessage: 'yanked.reason must be a string when provided.',
        valueMessage: 'yanked.reason must be a non-empty string when provided.'
      })
    )
  }

  return issues
}

function validateArtifact(
  value: unknown,
  path: string,
  options: ExtensionRegistryManifestValidationOptions
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'Artifact must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, ARTIFACT_KEYS, path, 'Unknown artifact field.'),
    ...validateRequiredArtifactTarget(value.target, `${path}.target`),
    ...validateRequiredSecureUrl(value.url, `${path}.url`, options, 'artifact.url'),
    ...validatePositiveInteger(value.size, `${path}.size`, 'artifact.size'),
    ...validateSha256(value.sha256, `${path}.sha256`, 'artifact.sha256')
  )

  if (value.signature !== undefined) {
    issues.push(...validateArtifactSignature(value.signature, `${path}.signature`))
  }

  return issues
}

function validateArtifactSignature(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!isPlainObject(value)) {
    return [{ path, message: 'signature must be an object.' }]
  }

  issues.push(
    ...validateUnknownKeysWithMessage(value, SIGNATURE_KEYS, path, 'Unknown signature field.'),
    ...validateRequiredString(value.keyId, `${path}.keyId`, {
      minLength: 1,
      trim: true,
      valueMessage: 'signature.keyId must be a non-empty string.'
    }),
    ...validateRequiredEnumString(
      value.algorithm,
      `${path}.algorithm`,
      EXTENSION_REGISTRY_SIGNING_ALGORITHMS,
      'signature.algorithm must be ed25519.'
    ),
    ...validateRequiredBase64(value.value, `${path}.value`, 'signature.value')
  )

  return issues
}

function validatePackageCategories(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  issues.push(
    ...validateRequiredArray(value, path, {
      minLength: 1,
      typeMessage: 'categories must be an array.',
      valueMessage: 'categories must contain at least one item.'
    })
  )

  if (!Array.isArray(value)) {
    return issues
  }

  const seen = new Set<string>()
  for (const [index, category] of value.entries()) {
    if (!isExtensionCategory(category)) {
      issues.push({
        path: `${path}[${index}]`,
        message: 'Category must be one of the official extension categories.'
      })
      continue
    }

    if (seen.has(category)) {
      issues.push({
        path: `${path}[${index}]`,
        message: 'Duplicate category values are not allowed.'
      })
    }
    seen.add(category)
  }

  return issues
}

function validatePackageKeywords(value: unknown, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (value === undefined) {
    return issues
  }

  if (!Array.isArray(value)) {
    return [{ path, message: 'keywords must be an array of strings.' }]
  }

  const seen = new Set<string>()
  for (const [index, keyword] of value.entries()) {
    if (typeof keyword !== 'string' || keyword.trim().length === 0) {
      issues.push({
        path: `${path}[${index}]`,
        message: 'Keyword must be a non-empty string.'
      })
      continue
    }

    if (seen.has(keyword)) {
      issues.push({
        path: `${path}[${index}]`,
        message: 'Duplicate keyword values are not allowed.'
      })
    }
    seen.add(keyword)
  }

  return issues
}

function validateRegistrySchemaVersion(value: unknown, path: string): ValidationIssue[] {
  if (value !== EXTENSION_REGISTRY_SCHEMA_VERSION) {
    return [{ path, message: `schemaVersion must be ${EXTENSION_REGISTRY_SCHEMA_VERSION}.` }]
  }

  return []
}

function validateRequiredArtifactTarget(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    minLength: 1,
    trim: true,
    valueMessage: 'target must be a non-empty string.'
  })

  if (typeof value === 'string' && !matchesExtensionRegistryArtifactTargetFormat(value)) {
    issues.push({
      path,
      message: 'target must be "any" or a platform-architecture pair such as "win32-x64".'
    })
  }

  return issues
}

function validateRequiredIsoUtcString(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    minLength: 1,
    trim: true,
    valueMessage: 'Field must be a non-empty ISO 8601 UTC string.'
  })

  if (typeof value === 'string' && !isIsoUtcDateString(value)) {
    issues.push({
      path,
      message: 'Field must be a valid ISO 8601 UTC string ending with Z.'
    })
  }

  return issues
}

function validateRequiredSecureUrl(
  value: unknown,
  path: string,
  options: ExtensionRegistryManifestValidationOptions,
  label: string
): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    minLength: 1,
    trim: true,
    valueMessage: `${label} must be a non-empty URL.`
  })

  if (typeof value === 'string') {
    issues.push(...validateUrl(value, path, { httpsOnly: true, ...options }, label))
  }

  return issues
}

function validateOptionalUri(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  const issues = validateRequiredString(value, path, {
    minLength: 1,
    trim: true,
    typeMessage: 'Field must be a string when provided.',
    valueMessage: 'Field must be a non-empty URI when provided.'
  })

  if (typeof value === 'string') {
    issues.push(...validateUrl(value, path, { httpsOnly: false }, 'URI'))
  }

  return issues
}

function validateUrl(
  value: string,
  path: string,
  options: ExtensionRegistryManifestValidationOptions & { httpsOnly: boolean },
  label: string
): ValidationIssue[] {
  let parsed: URL

  try {
    parsed = new URL(value)
  } catch {
    return [{ path, message: `${label} must be a valid URL.` }]
  }

  if (!options.httpsOnly || parsed.protocol === 'https:') {
    return []
  }

  if (options.allowInsecureLocalUrls && isLocalDevelopmentUrl(parsed)) {
    return []
  }

  return [{ path, message: `${label} must use https.` }]
}

function validatePositiveInteger(value: unknown, path: string, label: string): ValidationIssue[] {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return []
  }

  return [{ path, message: `${label} must be a positive integer.` }]
}

function validateSha256(value: unknown, path: string, label: string): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    minLength: 64,
    valueMessage: `${label} must be a lowercase hex sha256 digest.`
  })

  if (typeof value === 'string' && !SHA256_HEX_PATTERN.test(value)) {
    issues.push({
      path,
      message: `${label} must be a lowercase 64-character hex sha256 digest.`
    })
  }

  return issues
}

function validateRequiredBase64(value: unknown, path: string, label: string): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    minLength: 1,
    valueMessage: `${label} must be a non-empty base64 string.`
  })

  if (typeof value === 'string' && !BASE64_PATTERN.test(value)) {
    issues.push({
      path,
      message: `${label} must be a valid base64 string.`
    })
  }

  return issues
}

function validateUnknownKeysWithMessage(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
  basePath: string,
  message: string
): ValidationIssue[] {
  return validateUnknownKeys(value, allowedKeys, basePath).map((issue) => ({
    ...issue,
    message
  }))
}

function trackUniqueStringProperty(
  value: unknown,
  property: string,
  path: string,
  seen: Set<string>,
  message: string
): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return []
  }

  const propertyValue = value[property]
  if (typeof propertyValue !== 'string') {
    return []
  }

  if (seen.has(propertyValue)) {
    return [{ path, message }]
  }

  seen.add(propertyValue)
  return []
}

function isIsoUtcDateString(value: string): boolean {
  const match = ISO_UTC_PATTERN.exec(value)

  if (!match) {
    return false
  }

  const fraction = match[7] ?? ''
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.${fraction.padEnd(3, '0')}Z`
  const parsed = new Date(value)

  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === normalized
}

function isLocalDevelopmentUrl(value: URL): boolean {
  if (value.protocol === 'file:') {
    return true
  }

  if (value.protocol !== 'http:') {
    return false
  }

  const hostname = value.hostname.toLowerCase()
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

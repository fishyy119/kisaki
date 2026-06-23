import {
  EXTENSION_REGISTRY_SCHEMA_URL,
  EXTENSION_REGISTRY_SCHEMA_VERSION,
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki3/extension-registry'
import { CliError } from '../errors'
import { formatValidationIssues } from '../validation'
import { compactRegistryManifest } from './normalization'
import { assertRegistryArtifactSignaturesValid } from './signature'

/** Optional validation policy for local registry development. */
export interface RegistryManifestValidationOptions {
  allowInsecureLocalUrls?: boolean
}

/** Metadata used to create an empty registry manifest. */
export interface CreateRegistryManifestInput {
  id: string
  name: string
  description?: string
  homepage?: string
}

/** Creates and validates an empty registry manifest. */
export function createRegistryManifest(
  input: CreateRegistryManifestInput
): ExtensionRegistryManifest {
  const manifest = compactRegistryManifest({
    $schema: EXTENSION_REGISTRY_SCHEMA_URL,
    schemaVersion: EXTENSION_REGISTRY_SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    description: input.description,
    homepage: input.homepage,
    updatedAt: new Date().toISOString(),
    signingKeys: [],
    packages: []
  })
  assertValidRegistryManifest(manifest)
  return manifest
}

/** Validates a registry manifest that is already in memory. */
export function assertValidRegistryManifest(
  manifest: unknown,
  options: RegistryManifestValidationOptions = {}
): ExtensionRegistryManifest {
  const parsed = parseExtensionRegistryManifest(manifest, toValidationOptions(options))
  if (!parsed.manifest) {
    throw new CliError(formatValidationIssues('Registry manifest is invalid.', parsed.issues))
  }
  assertRegistryArtifactSignaturesValid(parsed.manifest)
  return parsed.manifest
}

function toValidationOptions(options: RegistryManifestValidationOptions): {
  allowInsecureLocalUrls?: boolean
} {
  return options.allowInsecureLocalUrls === undefined
    ? {}
    : { allowInsecureLocalUrls: options.allowInsecureLocalUrls }
}

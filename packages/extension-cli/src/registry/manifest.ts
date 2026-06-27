import {
  parseExtensionRegistryManifest,
  type ExtensionRegistryManifest
} from '@kisaki3/extension-registry'
import { CliError } from '../errors'
import { formatValidationIssues } from '../validation'
import { assertRegistryArtifactSignaturesValid } from './signature'

/** Optional validation policy for local registry development. */
export interface RegistryManifestValidationOptions {
  allowInsecureLocalUrls?: boolean
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

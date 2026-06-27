import semver from 'semver'
import { isExtensionIdentifier } from '@kisaki3/extension-api'
import { CliError } from '../errors'

/** One registry release identity accepted by maintenance commands. */
export interface RegistryReleaseReference {
  packageId: string
  version: string
}

/** Parses `<extension-id>@<version>` into a validated registry release identity. */
export function parseRegistryReleaseReference(value: string): RegistryReleaseReference {
  const separatorIndex = value.lastIndexOf('@')
  if (separatorIndex <= 0 || separatorIndex === value.length - 1) {
    throw new CliError('Release must use <extension-id>@<version>.')
  }

  const packageId = value.slice(0, separatorIndex)
  if (!isExtensionIdentifier(packageId)) {
    throw new CliError('Release extension id must use lowercase dot-separated segments.')
  }

  const version = semver.valid(value.slice(separatorIndex + 1))
  if (!version) {
    throw new CliError('Release version must be a valid semver version.')
  }

  return { packageId, version }
}

import { isExtensionIdentifier } from '@kisaki3/extension-api'

/** Checks a filesystem-safe repository directory name. */
export function matchesRepositoryNameFormat(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(value.trim())
}

/** Normalizes an identifier-like value into an unscoped package name. */
export function toPackageName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^[._]+/, '')
    .toLowerCase()
}

/** Checks a lowercase npm package name, including optional scopes. */
export function matchesPackageNameFormat(value: string): boolean {
  const normalized = value.trim()
  return (
    normalized.length > 0 &&
    normalized.length <= 214 &&
    /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(normalized)
  )
}

/** Checks a registry manifest id. */
export function matchesRegistryIdFormat(value: string): boolean {
  return matchesKisakiIdentifierFormat(value)
}

/** Checks an extension manifest id. */
export function matchesExtensionIdFormat(value: string): boolean {
  return matchesKisakiIdentifierFormat(value)
}

/** Normalizes free-form text into a registry manifest id. */
export function toRegistryId(value: string): string {
  return toKisakiIdentifier(value)
}

/** Normalizes free-form text into an extension manifest id. */
export function toExtensionId(value: string): string {
  return toKisakiIdentifier(value)
}

function toKisakiIdentifier(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .split('.')
    .map((segment) => segment.replace(/-+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('.')

  if (matchesKisakiIdentifierFormat(normalized)) {
    return normalized
  }

  return 'my-kisaki-extension'
}

function matchesKisakiIdentifierFormat(value: string): boolean {
  return isExtensionIdentifier(value)
}

/** Converts an identifier-like value into a readable name. */
export function toReadableName(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

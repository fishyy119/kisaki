import { isExtensionIdentifier } from '@kisaki3/extension-api'

/** Checks a filesystem-safe scaffold directory name. */
export function matchesProjectNameFormat(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(value.trim())
}

/** Normalizes a directory or extension id into an unscoped package name. */
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

/** Normalizes free-form text into a valid extension identifier. */
export function toExtensionId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .split('.')
    .map((segment) => segment.replace(/-+/g, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('.')

  if (isExtensionIdentifier(normalized)) {
    return normalized
  }

  return 'my-kisaki-extension'
}

/** Converts an identifier-like value into a readable display name. */
export function toDisplayName(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

import { isExtensionIdentifier } from '@kisaki3/extension-api'

export function isProjectName(value: string): boolean {
  return /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/.test(value.trim())
}

export function toPackageName(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/^[._]+/, '')
    .toLowerCase()
}

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

export function toDisplayName(value: string): string {
  return value.replace(/[._-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

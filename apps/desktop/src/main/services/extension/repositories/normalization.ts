import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ExtensionRepositoryState } from '@shared/extension'

export function normalizeOptionalName(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

export function normalizeRepositoryState(
  value: ExtensionRepositoryState | undefined
): ExtensionRepositoryState | undefined {
  if (value === undefined || value === 'enabled' || value === 'disabled') {
    return value
  }

  throw new Error('Repository state must be enabled or disabled.')
}

export function normalizePriority(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Number.isSafeInteger(value)) {
    throw new Error('Repository priority must be a safe integer.')
  }

  return value
}

export function normalizeManifestUrl(
  value: string,
  options: { allowInsecureLocalUrls: boolean }
): string {
  const input = requireNonEmptyString(value, 'repository URL').trim()
  let url: URL

  try {
    url = new URL(input)
  } catch {
    if (!options.allowInsecureLocalUrls) {
      throw new Error('Repository URL must be a valid https URL.')
    }
    url = new URL(pathToFileURL(path.resolve(input)).toString())
  }

  if (url.protocol === 'https:') {
    return url.toString()
  }

  if (options.allowInsecureLocalUrls && isLocalDevelopmentUrl(url)) {
    return url.toString()
  }

  throw new Error('Repository URL must use https.')
}

export function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`)
  }

  return value
}

function isLocalDevelopmentUrl(url: URL): boolean {
  if (url.protocol === 'file:') {
    return true
  }

  if (url.protocol !== 'http:') {
    return false
  }

  const hostname = url.hostname.toLowerCase()
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

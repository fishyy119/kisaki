/**
 * Contribution icon contract shared by contribution points whose icons render
 * inside the app chrome (top-level navigation, menus).
 *
 * Two forms, disambiguated by prefix:
 * - `mdi:<name>` references a Material Design Icon bundled with the app,
 *   e.g. `mdi:sync`.
 * - `./<path>` references an image file inside the extension package,
 *   e.g. `./assets/sync.svg`.
 *
 * The app renders both forms as a currentColor mask so contribution icons
 * follow the surrounding chrome tone. Custom files should therefore be
 * monochrome silhouettes; color information is intentionally discarded.
 */

import type { ValidationIssue } from './validation'

export type ContributionIcon = `mdi:${string}` | `./${string}`

export const MDI_ICON_FORMAT = /^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/

export const CONTRIBUTION_ICON_FILE_EXTENSIONS = ['.svg', '.png', '.webp', '.jpg', '.jpeg'] as const

const CONTRIBUTION_ICON_FILE_FORMAT = /^\.\/(?:[^\\/]+\/)*[^\\/]+\.(?:svg|png|webp|jpg|jpeg)$/i

export function matchesMdiIconFormat(value: unknown): value is `mdi:${string}` {
  return typeof value === 'string' && MDI_ICON_FORMAT.test(value)
}

/**
 * Lexical check for the package-file icon form: `./`-prefixed relative path
 * with an image extension and no parent-directory segments. Confinement to
 * the real package root stays a host boundary concern.
 */
export function matchesContributionIconFileFormat(value: unknown): value is `./${string}` {
  if (typeof value !== 'string' || !CONTRIBUTION_ICON_FILE_FORMAT.test(value)) {
    return false
  }

  return value
    .slice(2)
    .split('/')
    .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

export function matchesContributionIconFormat(value: unknown): value is ContributionIcon {
  return matchesMdiIconFormat(value) || matchesContributionIconFileFormat(value)
}

const CONTRIBUTION_ICON_MESSAGE =
  'icon must be an "mdi:<name>" reference or a "./" package-relative image path (.svg, .png, .webp, .jpg, .jpeg).'

export function validateRequiredContributionIcon(value: unknown, path: string): ValidationIssue[] {
  if (matchesContributionIconFormat(value)) {
    return []
  }

  return [{ path, message: CONTRIBUTION_ICON_MESSAGE }]
}

export function validateOptionalContributionIcon(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  return validateRequiredContributionIcon(value, path)
}

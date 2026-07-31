import { normalizeExtensionPackagePath } from '../../manifest'
import { validateLocalizedTextShape } from '../../shared/locales'
import {
  validateOptionalContributionIcon,
  validateRequiredContributionIcon
} from '../../shared/icon'
import type { ValidationIssue } from '../../shared/validation'
import {
  isPlainObject,
  validateOptionalEnumString,
  validateOptionalFiniteNumber,
  validateRequiredString,
  validateUnknownKeys
} from '../../shared/validation'
import {
  WEBVIEW_DIALOG_SIZES,
  type WebviewDialogContribution,
  type WebviewPageContribution
} from './contracts'

/**
 * Page and dialog ids become stable app-facing identity (routes, open
 * requests), so they stay URL-safe by construction.
 */
export const WEBVIEW_SURFACE_ID_FORMAT = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/

export function matchesWebviewSurfaceIdFormat(value: unknown): value is string {
  return typeof value === 'string' && WEBVIEW_SURFACE_ID_FORMAT.test(value) && value.length <= 64
}

const WEBVIEW_PAGE_CONTRIBUTION_KEYS = new Set<string>(['id', 'title', 'entry', 'icon', 'nav'])

const WEBVIEW_PAGE_NAV_KEYS = new Set<string>(['order'])

const WEBVIEW_DIALOG_CONTRIBUTION_KEYS = new Set<string>(['id', 'title', 'entry', 'size'])

function validateWebviewSurfaceId(value: unknown, path: string): ValidationIssue[] {
  if (matchesWebviewSurfaceIdFormat(value)) {
    return []
  }

  return [
    {
      path,
      message:
        'id must be a lowercase alphanumeric identifier with "-" or "." separators (max 64 chars).'
    }
  ]
}

function validateWebviewEntry(value: unknown, path: string): ValidationIssue[] {
  const issues = validateRequiredString(value, path, {
    trim: true,
    valueMessage: 'entry must be a non-empty string.'
  })
  if (issues.length > 0 || typeof value !== 'string') {
    return issues
  }

  const normalized = normalizeExtensionPackagePath(value)
  if (!normalized) {
    return [{ path, message: 'entry must be relative and stay inside the manifest ui root.' }]
  }

  if (!normalized.endsWith('.html')) {
    return [{ path, message: 'entry must point to an .html document.' }]
  }

  return []
}

export function validateWebviewPageContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Webview page contribution must be an object.' }]
  }

  const issues: ValidationIssue[] = [
    ...validateUnknownKeys(value, WEBVIEW_PAGE_CONTRIBUTION_KEYS),
    ...validateWebviewSurfaceId(value.id, '$.id'),
    ...validateLocalizedTextShape(value.title, '$.title'),
    ...validateWebviewEntry(value.entry, '$.entry')
  ]

  if (value.nav === undefined) {
    issues.push(...validateOptionalContributionIcon(value.icon, '$.icon'))
    return issues
  }

  // Navigation entries always render an icon.
  issues.push(...validateRequiredContributionIcon(value.icon, '$.icon'))

  if (!isPlainObject(value.nav)) {
    issues.push({ path: '$.nav', message: 'nav must be an object when provided.' })
    return issues
  }

  issues.push(
    ...validateUnknownKeys(value.nav, WEBVIEW_PAGE_NAV_KEYS, '$.nav'),
    ...validateOptionalFiniteNumber(
      value.nav.order,
      '$.nav.order',
      'nav.order must be a finite number when provided.'
    )
  )

  return issues
}

export function validateWebviewDialogContributionShape(value: unknown): ValidationIssue[] {
  if (!isPlainObject(value)) {
    return [{ path: '$', message: 'Webview dialog contribution must be an object.' }]
  }

  return [
    ...validateUnknownKeys(value, WEBVIEW_DIALOG_CONTRIBUTION_KEYS),
    ...validateWebviewSurfaceId(value.id, '$.id'),
    ...validateLocalizedTextShape(value.title, '$.title'),
    ...validateWebviewEntry(value.entry, '$.entry'),
    ...validateOptionalEnumString(
      value.size,
      '$.size',
      WEBVIEW_DIALOG_SIZES,
      `size must be one of: ${WEBVIEW_DIALOG_SIZES.join(', ')}.`
    )
  ]
}

export function isWebviewPageContribution(value: unknown): value is WebviewPageContribution {
  return validateWebviewPageContributionShape(value).length === 0
}

export function isWebviewDialogContribution(value: unknown): value is WebviewDialogContribution {
  return validateWebviewDialogContributionShape(value).length === 0
}

import type { ValidationIssue } from '../../shared/validation'
import { EXTENSION_HOOK_POINTS, type ExtensionHookPointId } from './catalog'

const HOOK_POINT_ID_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/

/** Structural check for untrusted hook point id input. */
export function matchesHookPointIdFormat(value: unknown): value is string {
  return typeof value === 'string' && HOOK_POINT_ID_PATTERN.test(value)
}

/** Whether a string names a hook point in the public catalog. */
export function matchesKnownHookPointId(value: unknown): value is ExtensionHookPointId {
  return matchesHookPointIdFormat(value) && value in EXTENSION_HOOK_POINTS
}

export function validateHookPointId(value: unknown, path: string): ValidationIssue[] {
  if (!matchesHookPointIdFormat(value)) {
    return [{ path, message: 'Hook point id must be a dot-separated lowercase identifier.' }]
  }

  if (!(value in EXTENSION_HOOK_POINTS)) {
    return [{ path, message: `Unknown hook point "${value}".` }]
  }

  return []
}

export function validateHookTapOptionsShape(value: unknown, path: string): ValidationIssue[] {
  if (value === undefined) {
    return []
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [{ path, message: 'Hook tap options must be an object when provided.' }]
  }

  const issues: ValidationIssue[] = []
  const options = value as Record<string, unknown>
  for (const key of Object.keys(options)) {
    if (key !== 'priority') {
      issues.push({ path: `${path}.${key}`, message: `Unknown hook tap option "${key}".` })
    }
  }

  if (options.priority !== undefined && !Number.isFinite(options.priority)) {
    issues.push({ path: `${path}.priority`, message: 'priority must be a finite number.' })
  }

  return issues
}

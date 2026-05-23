import path from 'node:path'
import {
  createValidationError,
  isExtensionIdentifier,
  validateExtensionIdentifier
} from '@kisaki3/extension-api'

export function requireSafeExtensionId(value: unknown, label = 'extensionId'): string {
  if (isExtensionIdentifier(value)) {
    return value
  }

  const issues = validateExtensionIdentifier(value, label)
  throw createValidationError(issues[0]?.message ?? `${label} is not a valid extension id.`)
}

export function resolveInsideRoot(rootDir: string, ...segments: readonly string[]): string {
  const root = path.resolve(rootDir)
  const candidate = path.resolve(root, ...segments)
  assertInsideRoot(candidate, root)
  return candidate
}

export function resolveExtensionIdPath(rootDir: string, extensionId: string): string {
  return resolveInsideRoot(rootDir, requireSafeExtensionId(extensionId))
}

export function assertInsideRoot(candidatePath: string, rootDir: string): void {
  if (isInsideOrEqualPath(rootDir, candidatePath)) {
    return
  }

  throw createValidationError(`Path must stay within "${path.resolve(rootDir)}".`)
}

export function assertInsideAnyRoot(
  candidatePath: string,
  rootDirs: readonly string[],
  label: string
): void {
  for (const rootDir of rootDirs) {
    if (isInsideOrEqualPath(rootDir, candidatePath)) {
      return
    }
  }

  throw createValidationError(`${label} must stay within an allowed extension directory.`)
}

export function isInsideOrEqualPath(rootDir: string, candidatePath: string): boolean {
  const root = path.resolve(rootDir)
  const candidate = path.resolve(candidatePath)
  const relative = path.relative(root, candidate)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

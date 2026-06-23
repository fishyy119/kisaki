import path from 'node:path'
import type { BuiltinExtensionBuildTarget, BuiltinExtensionToolContext } from './types'

/** Resolves the root directory where built-in extensions are written. */
export function resolveBuiltinExtensionOutputRoot(
  context: BuiltinExtensionToolContext,
  target: BuiltinExtensionBuildTarget
): string {
  if (target === 'resources') {
    return path.join(context.desktopRoot, 'resources', 'extensions')
  }

  return path.join(context.desktopRoot, 'out', 'extensions')
}

/** Resolves the sibling debug package directory for built-in extension output. */
export function resolveBuiltinExtensionDebugPackagesRoot(outputRoot: string): string {
  return path.join(path.dirname(outputRoot), 'packages')
}

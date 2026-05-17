import type { ValidationIssue } from '@kisaki/extension-api'
import { createValidationError } from '@kisaki/extension-api'
import type { ExtensionRegistry, LoadedExtensionRuntime } from '../extension-registry'
import type { HostContributionScope } from './types'

export function requireRuntimeByScope(
  registry: ExtensionRegistry,
  scope: HostContributionScope
): LoadedExtensionRuntime {
  const runtime = registry.getByRuntimeHandle(scope.runtimeHandle)
  if (!runtime || runtime.metadata.id !== scope.extensionId) {
    throw new Error(`Extension runtime "${scope.runtimeHandle}" is not active.`)
  }

  return runtime
}

export function formatValidationIssues(issues: readonly ValidationIssue[]): string {
  return issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n')
}

export function throwValidationIssues(label: string, issues: readonly ValidationIssue[]): never {
  throw createValidationError(`${label} is invalid:\n${formatValidationIssues(issues)}`, {
    issues: issues.map((issue) => ({
      path: issue.path,
      message: issue.message
    }))
  })
}

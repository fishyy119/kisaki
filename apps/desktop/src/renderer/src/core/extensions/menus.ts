import type { EntityMenuResolveInput } from '@kisaki/extension-api'
import { invokeExtensionEntityMenu, resolveExtensionEntityMenu } from './ipc'

export { invokeExtensionEntityMenu, resolveExtensionEntityMenu }

export function getEntityMenuInputKey(input: EntityMenuResolveInput): string {
  if (input.scope === 'batch') {
    return `${input.target}:${input.entityIds.join(',')}`
  }

  return `${input.target}:${input.entityId}`
}

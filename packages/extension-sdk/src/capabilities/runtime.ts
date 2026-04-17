import type { RuntimeCapability } from '@kisaki/extension-api'
import { getExtensionSdkBridge } from '../bridge'

export function getRuntimeCapability(): RuntimeCapability {
  return getExtensionSdkBridge().api.runtime
}

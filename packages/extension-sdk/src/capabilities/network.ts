import type { NetworkCapability } from '@kisaki/extension-api'
import { getExtensionSdkBridge } from '../bridge'

export function getNetworkCapability(): NetworkCapability {
  return getExtensionSdkBridge().api.network
}

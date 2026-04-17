import type { NotifyCapability } from '@kisaki/extension-api'
import { getExtensionSdkBridge } from '../bridge'

export function getNotifyCapability(): NotifyCapability {
  return getExtensionSdkBridge().api.notify
}

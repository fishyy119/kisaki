import type { EventsCapability } from '@kisaki/extension-api'
import { getExtensionSdkBridge } from '../bridge'

export function getEventsCapability(): EventsCapability {
  return getExtensionSdkBridge().api.events
}

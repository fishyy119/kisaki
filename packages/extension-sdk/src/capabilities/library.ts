import type { LibraryCapability } from '@kisaki/extension-api'
import { getExtensionSdkBridge } from '../bridge'

export function getLibraryCapability(): LibraryCapability {
  return getExtensionSdkBridge().api.library
}

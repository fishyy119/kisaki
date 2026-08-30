import {
  matchesContributionIconFormat,
  matchesMdiIconFormat,
  type ContributionIcon
} from '@kisaki3/extension-api'
import type { ExtensionIconInfo } from '@shared/extension'
import { extensionFileUrl } from '../assets/files'

/**
 * Translates the public contribution icon contract into the renderer DTO.
 * File icons resolve to `kisaki-extension-file://` URLs served out of the
 * extension package; the protocol handler confines paths at serve time.
 */
export function resolveContributionIcon(
  extensionId: string,
  icon: ContributionIcon
): ExtensionIconInfo {
  if (matchesMdiIconFormat(icon)) {
    return { kind: 'mdi', name: icon.slice('mdi:'.length) }
  }

  return { kind: 'url', url: extensionFileUrl(extensionId, icon.slice(2)) }
}

/**
 * Guarded variant for host-resolved values whose format was validated at the
 * extension host boundary. Unknown shapes map to `undefined` so a bad icon
 * never breaks the surrounding contribution.
 */
export function resolveOptionalContributionIcon(
  extensionId: string,
  icon: unknown
): ExtensionIconInfo | undefined {
  if (!matchesContributionIconFormat(icon)) {
    return undefined
  }

  return resolveContributionIcon(extensionId, icon)
}

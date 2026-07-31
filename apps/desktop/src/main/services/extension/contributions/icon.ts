import { pathToFileURL } from 'node:url'
import {
  matchesContributionIconFormat,
  matchesMdiIconFormat,
  type ContributionIcon
} from '@kisaki3/extension-api'
import type { ExtensionIconInfo } from '@shared/extension'
import { resolveInsideRoot } from '../shared/path-confinement'

/**
 * Translates the public contribution icon contract into the renderer DTO.
 * File icons resolve to app-local `file://` URLs confined to the extension
 * package root, matching how manifest package icons are served.
 */
export function resolveContributionIcon(
  extensionPath: string,
  icon: ContributionIcon
): ExtensionIconInfo {
  if (matchesMdiIconFormat(icon)) {
    return { kind: 'mdi', name: icon.slice('mdi:'.length) }
  }

  const filePath = resolveInsideRoot(extensionPath, ...icon.slice(2).split('/').filter(Boolean))
  return { kind: 'url', url: pathToFileURL(filePath).toString() }
}

/**
 * Guarded variant for host-resolved values whose format was validated at the
 * extension host boundary. Unknown shapes map to `undefined` so a bad icon
 * never breaks the surrounding contribution.
 */
export function resolveOptionalContributionIcon(
  extensionPath: string,
  icon: unknown
): ExtensionIconInfo | undefined {
  if (!matchesContributionIconFormat(icon)) {
    return undefined
  }

  return resolveContributionIcon(extensionPath, icon)
}

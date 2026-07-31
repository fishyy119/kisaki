/**
 * Runtime MDI icon registry for icon names only known at runtime (extension
 * contributions). The full MDI set loads as one lazily imported chunk on
 * first use, so it never weighs on startup; static app icons keep the
 * zero-runtime build-time Tailwind plugin.
 */

import { getIconData, iconToHTML, iconToSVG, replaceIDs, svgToURL } from '@iconify/utils'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Icon')

/** Fallback for unknown names so a bad contribution never renders as a gap. */
const MDI_FALLBACK_ICON = 'puzzle-outline'

type MdiIconSet = typeof import('@iconify-json/mdi').icons

let iconSetPromise: Promise<MdiIconSet> | null = null
const maskUrlCache = new Map<string, string | null>()
const warnedUnknownNames = new Set<string>()

function loadIconSet(): Promise<MdiIconSet> {
  iconSetPromise ??= import('@iconify-json/mdi').then((module) => module.icons)
  return iconSetPromise
}

/**
 * Resolves an MDI icon name (without the `mdi:` prefix, aliases included) to
 * a CSS `mask-image` URL value. Unknown names resolve to the fallback icon.
 */
export async function resolveMdiIconMaskUrl(name: string): Promise<string | null> {
  const cached = maskUrlCache.get(name)
  if (cached !== undefined) {
    return cached
  }

  const iconSet = await loadIconSet()
  let iconData = getIconData(iconSet, name)
  if (!iconData) {
    if (!warnedUnknownNames.has(name)) {
      warnedUnknownNames.add(name)
      log.debug(`Unknown MDI icon "${name}"; falling back to "${MDI_FALLBACK_ICON}".`)
    }
    iconData = getIconData(iconSet, MDI_FALLBACK_ICON)
  }

  let maskUrl: string | null = null
  if (iconData) {
    const svg = iconToSVG(iconData)
    maskUrl = svgToURL(iconToHTML(replaceIDs(svg.body), svg.attributes))
  }
  maskUrlCache.set(name, maskUrl)
  return maskUrl
}

import { YMGAL_CDN_BASE_URL } from '../../utils/constants'
import { trimToUndefined } from './text'

/** Archives with no artwork point at this shared placeholder. */
const PLACEHOLDER_IMAGE_PATH = '/archive/def_img.webp'

/**
 * Resolves an archive image reference to an absolute URL.
 *
 * YMGal returns absolute URLs, protocol-relative URLs, and CDN-relative paths
 * interchangeably.
 */
export function resolveImageUrl(value: string | null | undefined): string | undefined {
  const raw = trimToUndefined(value)
  if (!raw) {
    return undefined
  }

  let candidate = raw
  if (candidate.startsWith('//')) {
    candidate = `https:${candidate}`
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = candidate.startsWith('/')
      ? `${YMGAL_CDN_BASE_URL}${candidate}`
      : `${YMGAL_CDN_BASE_URL}/${candidate}`
  }

  try {
    return new URL(candidate).toString()
  } catch {
    return undefined
  }
}

/** Absolute http(s) URL, or `undefined` for anything else. */
export function resolveHttpUrl(value: string | null | undefined): string | undefined {
  const raw = trimToUndefined(value)
  if (!raw) {
    return undefined
  }

  const candidate = raw.startsWith('//') ? `https:${raw}` : raw
  if (!/^https?:\/\//i.test(candidate)) {
    return undefined
  }

  try {
    return new URL(candidate).toString()
  } catch {
    return undefined
  }
}

/**
 * Image URLs in source order, deduplicated. The shared placeholder is dropped:
 * it states the archive has no artwork, not that this artwork exists.
 */
export function dedupeImageUrls(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const url = resolveImageUrl(value)
    if (!url || url.includes(PLACEHOLDER_IMAGE_PATH) || seen.has(url)) {
      continue
    }
    seen.add(url)
    output.push(url)
  }

  return output
}

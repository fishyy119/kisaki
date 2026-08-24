import type { IgdbImageRow } from '../../api/types'
import { IGDB_IMAGE_BASE_URL } from '../../utils/constants'
import { trimToUndefined } from './text'

/**
 * IGDB serves one upload at many sizes, named in the URL. Each usage picks the
 * largest size that matches what the app stores.
 */
export type IgdbImageSize = 'cover_big' | 'screenshot_huge' | '720p' | 'logo_med'

export function resolveImageUrl(
  image: IgdbImageRow | null | undefined,
  size: IgdbImageSize
): string | undefined {
  if (!image) {
    return undefined
  }

  const imageId = trimToUndefined(image.image_id)
  if (imageId) {
    return `${IGDB_IMAGE_BASE_URL}/t_${size}/${imageId}.jpg`
  }

  const url = trimToUndefined(image.url)
  if (!url) {
    return undefined
  }

  const absolute = url.startsWith('//') ? `https:${url}` : url
  return absolute.replace(/\/t_[^/]+\//, `/t_${size}/`)
}

export function dedupeUrls(values: readonly (string | undefined)[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []

  for (const value of values) {
    const url = trimToUndefined(value)
    if (!url) {
      continue
    }

    const key = url.toLowerCase()
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(url)
  }

  return output
}

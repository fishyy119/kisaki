import { dedupeUrls } from './urls'

export function extractImageUrls(
  images?: {
    large?: string
    common?: string
    medium?: string
    small?: string
    grid?: string
  } | null
): string[] {
  if (!images) return []

  return dedupeUrls([images.large, images.common, images.medium, images.small, images.grid])
}

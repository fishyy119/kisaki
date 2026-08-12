import { isCancellationError } from '@kisaki3/extension-sdk'
import type { BangumiClient } from '../../api/client'
import type { BangumiSubject, BangumiSubjectRelation } from '../../api/types'
import { omitUndefined } from '../../utils/object'
import { extractImageUrls } from '../format/images'
import { dedupeUrls } from '../format/urls'
import type { BangumiSubjectImageVariants } from './types'

const MAX_COVERS = 10
const MAX_BACKDROPS = 20

export async function fetchSubjectImageVariants(
  client: BangumiClient,
  subjectId: number,
  signal?: AbortSignal
): Promise<BangumiSubjectImageVariants> {
  const [large, common, small, grid] = await Promise.all(
    (['large', 'common', 'small', 'grid'] as const).map((type) =>
      client.getSubjectImageUrl(subjectId, type, { signal }).catch((error: unknown) => {
        if (isCancellationError(error)) {
          throw error
        }

        return undefined
      })
    )
  )

  return omitUndefined({ large, common, small, grid })
}

export async function buildSubjectCovers(
  getSubject: () => Promise<BangumiSubject>,
  getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
): Promise<string[]> {
  const [subject, variants] = await Promise.all([getSubject(), getSubjectImageVariants()])

  return dedupeUrls([
    ...extractImageUrls(subject.images),
    variants.large,
    variants.common
  ]).slice(0, MAX_COVERS)
}

/**
 * Bangumi has no backdrop artwork, so related entries stand in for one; the
 * subject art is the fallback when the entry has no relations.
 */
export async function buildSubjectBackdrops(
  getSubject: () => Promise<BangumiSubject>,
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
): Promise<string[]> {
  const [subject, relations] = await Promise.all([getSubject(), getSubjectRelations()])

  const relatedImages = dedupeUrls(
    relations.flatMap((relation) => extractImageUrls(relation.images))
  )
  if (relatedImages.length > 0) {
    return relatedImages.slice(0, MAX_BACKDROPS)
  }

  return dedupeUrls(extractImageUrls(subject.images)).slice(0, MAX_COVERS)
}

export async function buildSubjectIcons(
  getSubject: () => Promise<BangumiSubject>,
  getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
): Promise<string[]> {
  const [subject, variants] = await Promise.all([getSubject(), getSubjectImageVariants()])

  return dedupeUrls([
    subject.images?.small,
    subject.images?.grid,
    variants.small,
    variants.grid
  ]).slice(0, MAX_COVERS)
}

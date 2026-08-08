import type { BangumiClient } from '../../../api/client'
import type { BangumiSubject, BangumiSubjectRelation } from '../../../api/types'
import { isCancellationError } from '../../../utils/errors'
import { omitUndefined } from '../../../utils/object'
import { extractImageUrls } from './format/images'
import { dedupeUrls } from './format/urls'
import type { BangumiSubjectImageVariants } from './types'

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

export async function buildGameCovers(
  getSubject: () => Promise<BangumiSubject>,
  getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
): Promise<string[]> {
  const [subject, variants] = await Promise.all([getSubject(), getSubjectImageVariants()])

  return dedupeUrls([...extractImageUrls(subject.images), variants.large, variants.common]).slice(
    0,
    10
  )
}

export async function buildGameBackdrops(
  getSubject: () => Promise<BangumiSubject>,
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
): Promise<string[]> {
  const [subject, relations] = await Promise.all([getSubject(), getSubjectRelations()])

  const relatedImages = dedupeUrls(
    relations.flatMap((relation) => extractImageUrls(relation.images))
  )
  if (relatedImages.length > 0) {
    return relatedImages.slice(0, 20)
  }

  return dedupeUrls(extractImageUrls(subject.images)).slice(0, 10)
}

export async function buildGameIcons(
  getSubject: () => Promise<BangumiSubject>,
  getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
): Promise<string[]> {
  const [subject, variants] = await Promise.all([getSubject(), getSubjectImageVariants()])

  return dedupeUrls([
    subject.images?.small,
    subject.images?.grid,
    variants.small,
    variants.grid
  ]).slice(0, 10)
}

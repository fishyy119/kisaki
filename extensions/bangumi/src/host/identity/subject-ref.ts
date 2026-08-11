import { BANGUMI_SOURCE_ID } from '../utils/constants'
import { getBangumiSubjectType, type BangumiMediaScope } from '../../shared/scopes'

export interface BangumiSubjectRef {
  scope: BangumiMediaScope
  subjectType: ReturnType<typeof getBangumiSubjectType>
  subjectId: number
}

export function createBangumiSubjectRef(
  scope: BangumiMediaScope,
  subjectId: string | number
): BangumiSubjectRef {
  return {
    scope,
    subjectType: getBangumiSubjectType(scope),
    subjectId: normalizeSubjectId(subjectId)
  }
}

export function readBangumiSubjectIdFromExternalIds(item: {
  externalIds: readonly { source: string; id: string }[]
}): string | undefined {
  const externalId = item.externalIds.find((candidate) => candidate.source === BANGUMI_SOURCE_ID)
  const id = externalId?.id.trim()
  return id && /^\d+$/.test(id) ? id : undefined
}

function normalizeSubjectId(value: string | number): number {
  const number = typeof value === 'string' ? Number.parseInt(value.trim(), 10) : value
  return Number.isFinite(number) && number > 0 ? Math.trunc(number) : 0
}

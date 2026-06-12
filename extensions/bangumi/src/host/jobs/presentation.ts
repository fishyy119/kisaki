import { getMediaScopeLabel } from '../media/labels'
import type { BangumiMediaScope } from '../media/scopes'
import type { BangumiJobPreviewGroup, BangumiJobPreviewRow } from '../../shared/settings'

export function formatBangumiSubjectTitle(
  nameCn: string | undefined,
  name: string | undefined,
  fallback: string | number
): string {
  return nameCn?.trim() || name?.trim() || `Bangumi ${fallback}`
}

export function createRemotePreviewGroup({
  scope,
  subjectId,
  title,
  rows
}: {
  scope: BangumiMediaScope
  subjectId: string | number
  title: string
  rows: readonly BangumiJobPreviewRow[]
}): BangumiJobPreviewGroup {
  return createPreviewGroup({
    title,
    subjectId,
    badge: { label: `${getMediaScopeLabel(scope)}远端预览`, tone: 'info' },
    rows
  })
}

export function createPreviewGroup({
  title,
  subjectId,
  badge,
  rows
}: {
  title: string
  subjectId: string | number
  badge: BangumiJobPreviewGroup['badges'][number]
  rows: readonly BangumiJobPreviewRow[]
}): BangumiJobPreviewGroup {
  return {
    id: `${subjectId}:${badge.label}`,
    title,
    link: createSubjectLink(subjectId),
    badges: [badge],
    rows
  }
}

function createSubjectLink(subjectId: string | number): { label: string; href: string } {
  return {
    label: `#${subjectId}`,
    href: `https://bgm.tv/subject/${subjectId}`
  }
}

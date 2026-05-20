import { getMediaScopeLabel } from '../../../media/labels'
import { BANGUMI_MEDIA_SCOPES, type BangumiMediaScope } from '../../../media/scopes'

export const MEDIA_SCOPE_OPTIONS = BANGUMI_MEDIA_SCOPES.map((scope) => ({
  value: scope,
  label: getMediaScopeLabel(scope)
})) satisfies readonly { value: BangumiMediaScope; label: string }[]

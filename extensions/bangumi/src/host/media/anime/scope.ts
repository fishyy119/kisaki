import { BANGUMI_COLLECTION_LABELS_BY_SCOPE, BANGUMI_SCOPE_LABELS } from '../labels'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
import type { RemoteOnlyMediaDescriptor } from '../types'

export function createAnimeMediaDescriptor(): RemoteOnlyMediaDescriptor {
  return {
    scope: 'anime',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.anime,
    label: BANGUMI_SCOPE_LABELS.anime,
    collectionLabels: BANGUMI_COLLECTION_LABELS_BY_SCOPE.anime
  }
}

import { BANGUMI_COLLECTION_LABELS_BY_SCOPE, BANGUMI_SCOPE_LABELS } from '../labels'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
import type { RemoteOnlyMediaDescriptor } from '../types'

export function createMusicMediaDescriptor(): RemoteOnlyMediaDescriptor {
  return {
    scope: 'music',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.music,
    label: BANGUMI_SCOPE_LABELS.music,
    collectionLabels: BANGUMI_COLLECTION_LABELS_BY_SCOPE.music
  }
}

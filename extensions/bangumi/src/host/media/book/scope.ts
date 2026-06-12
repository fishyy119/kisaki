import { BANGUMI_COLLECTION_LABELS_BY_SCOPE, BANGUMI_SCOPE_LABELS } from '../labels'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
import type { RemoteOnlyMediaDescriptor } from '../types'

export function createBookMediaDescriptor(): RemoteOnlyMediaDescriptor {
  return {
    scope: 'book',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.book,
    label: BANGUMI_SCOPE_LABELS.book,
    collectionLabels: BANGUMI_COLLECTION_LABELS_BY_SCOPE.book
  }
}

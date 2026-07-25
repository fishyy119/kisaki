import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
import type { RemoteOnlyMediaDescriptor } from '../types'

export function createBookMediaDescriptor(): RemoteOnlyMediaDescriptor {
  return {
    scope: 'book',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.book
  }
}

import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
import type { RemoteOnlyMediaDescriptor } from '../types'

export function createMusicMediaDescriptor(): RemoteOnlyMediaDescriptor {
  return {
    scope: 'music',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.music
  }
}

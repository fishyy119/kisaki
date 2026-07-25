import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../scopes'
import type { RemoteOnlyMediaDescriptor } from '../types'

export function createAnimeMediaDescriptor(): RemoteOnlyMediaDescriptor {
  return {
    scope: 'anime',
    subjectType: BANGUMI_SUBJECT_TYPE_BY_SCOPE.anime
  }
}

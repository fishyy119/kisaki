import type {
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiEpisode,
  BangumiPersonDetail,
  BangumiRelatedCharacter,
  BangumiRelatedPerson,
  BangumiSubject,
  BangumiSubjectRelation
} from '../../api/types'

export interface BangumiSubjectImageVariants {
  large?: string
  common?: string
  small?: string
  grid?: string
}

/**
 * Per-session lazy readers of one Bangumi subject.
 *
 * Every reader is memoized by the session, so scoped builders can request the
 * same upstream resource without duplicating requests.
 */
export interface BangumiSubjectLoaders {
  getSubject: () => Promise<BangumiSubject>
  getSubjectPersons: () => Promise<BangumiRelatedPerson[]>
  getSubjectCharacters: () => Promise<BangumiRelatedCharacter[]>
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
  getSubjectEpisodes: () => Promise<BangumiEpisode[]>
  getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>
  getCharacterDetails: () => Promise<Map<number, BangumiCharacterDetail>>
  getCharacterPersons: () => Promise<Map<number, BangumiCharacterPerson[]>>
  getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
}

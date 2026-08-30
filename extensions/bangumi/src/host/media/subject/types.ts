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
  large?: string | undefined
  common?: string | undefined
  small?: string | undefined
  grid?: string | undefined
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
  /**
   * Detail read of another subject this one relates to, memoized per id.
   *
   * A relation stub carries neither the platform label that tells a comic from
   * a novel nor a unit's release date, so both the related-entry and the unit
   * builders need the full subject; sharing one reader keeps that to one
   * request per related subject. Null when the read failed, which is missing
   * enrichment rather than a failed slot.
   */
  getRelatedSubject: (subjectId: number) => Promise<BangumiSubject | null>
}

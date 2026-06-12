import type {
  BangumiCharacterDetail,
  BangumiCharacterPerson,
  BangumiPersonDetail,
  BangumiRelatedCharacter,
  BangumiRelatedPerson,
  BangumiSubject,
  BangumiSubjectRelation
} from '../../../api/types'

export interface BangumiSubjectImageVariants {
  large?: string
  common?: string
  small?: string
  grid?: string
}

export interface BangumiGameSessionLoaders {
  getSubject: () => Promise<BangumiSubject>
  getSubjectPersons: () => Promise<BangumiRelatedPerson[]>
  getSubjectCharacters: () => Promise<BangumiRelatedCharacter[]>
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
  getPersonDetails: () => Promise<Map<number, BangumiPersonDetail>>
  getCharacterDetails: () => Promise<Map<number, BangumiCharacterDetail>>
  getCharacterPersons: () => Promise<Map<number, BangumiCharacterPerson[]>>
  getSubjectImageVariants: () => Promise<BangumiSubjectImageVariants>
}

import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { AnimePersister } from './anime'
import { CharacterPersister } from './character'
import { ComicPersister } from './comic'
import { CompanyPersister } from './company'
import { GamePersister } from './game'
import { NovelPersister } from './novel'
import { PersonPersister } from './person'

export class IngestPersisters {
  readonly person: PersonPersister
  readonly company: CompanyPersister
  readonly character: CharacterPersister
  readonly game: GamePersister
  readonly anime: AnimePersister
  readonly comic: ComicPersister
  readonly novel: NovelPersister

  constructor(dbService: DbService, i18nService: I18nService) {
    this.person = new PersonPersister(dbService, i18nService)
    this.company = new CompanyPersister(dbService, i18nService)
    this.character = new CharacterPersister(dbService, this.person, i18nService)
    this.game = new GamePersister(dbService, this.person, this.company, this.character, i18nService)
    this.anime = new AnimePersister(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
    this.comic = new ComicPersister(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
    this.novel = new NovelPersister(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
  }
}

export { AnimePersister } from './anime'
export { CharacterPersister } from './character'
export { ComicPersister } from './comic'
export { CompanyPersister } from './company'
export { insertAnimeEpisodeExternalIds, insertAnimeEpisodeRow } from './episodes'
export { insertComicChapterExternalIds, insertComicChapterRow } from './chapters'
export { insertNovelVolumeExternalIds, insertNovelVolumeRow } from './volumes'
export { GamePersister } from './game'
export { NovelPersister } from './novel'
export { PersonPersister } from './person'
export {
  pickFirstAssetUrl,
  type PersistAnimeGraphResult,
  type PersistCharacterGraphResult,
  type PersistComicGraphResult,
  type PersistCompanyGraphResult,
  type PersistGameGraphResult,
  type PersistNovelGraphResult,
  type PersistPersonGraphResult
} from './types'

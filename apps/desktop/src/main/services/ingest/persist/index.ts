import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { AnimeIngestPersistHandler } from './anime'
import { CharacterIngestPersistHandler } from './character'
import { ComicIngestPersistHandler } from './comic'
import { CompanyIngestPersistHandler } from './company'
import { GameIngestPersistHandler } from './game'
import { NovelIngestPersistHandler } from './novel'
import { PersonIngestPersistHandler } from './person'

export class IngestPersistHandlers {
  readonly person: PersonIngestPersistHandler
  readonly company: CompanyIngestPersistHandler
  readonly character: CharacterIngestPersistHandler
  readonly game: GameIngestPersistHandler
  readonly anime: AnimeIngestPersistHandler
  readonly comic: ComicIngestPersistHandler
  readonly novel: NovelIngestPersistHandler

  constructor(dbService: DbService, i18nService: I18nService) {
    this.person = new PersonIngestPersistHandler(dbService, i18nService)
    this.company = new CompanyIngestPersistHandler(dbService, i18nService)
    this.character = new CharacterIngestPersistHandler(dbService, this.person, i18nService)
    this.game = new GameIngestPersistHandler(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
    this.anime = new AnimeIngestPersistHandler(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
    this.comic = new ComicIngestPersistHandler(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
    this.novel = new NovelIngestPersistHandler(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
  }
}

export { AnimeIngestPersistHandler } from './anime'
export { CharacterIngestPersistHandler } from './character'
export { ComicIngestPersistHandler } from './comic'
export { CompanyIngestPersistHandler } from './company'
export { insertAnimeEpisodeExternalIds, insertAnimeEpisodeRow } from './episodes'
export { insertComicChapterExternalIds, insertComicChapterRow } from './chapters'
export { insertNovelVolumeExternalIds, insertNovelVolumeRow } from './volumes'
export { GameIngestPersistHandler } from './game'
export { NovelIngestPersistHandler } from './novel'
export { PersonIngestPersistHandler } from './person'
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

import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { AnimeIngestPersistHandler } from './anime'
import { CharacterIngestPersistHandler } from './character'
import { CompanyIngestPersistHandler } from './company'
import { GameIngestPersistHandler } from './game'
import { MovieIngestPersistHandler } from './movie'
import { PersonIngestPersistHandler } from './person'
import { TvIngestPersistHandler } from './tv'

export class IngestPersistHandlers {
  readonly person: PersonIngestPersistHandler
  readonly company: CompanyIngestPersistHandler
  readonly character: CharacterIngestPersistHandler
  readonly game: GameIngestPersistHandler
  readonly anime: AnimeIngestPersistHandler
  readonly tv: TvIngestPersistHandler
  readonly movie: MovieIngestPersistHandler

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
    this.tv = new TvIngestPersistHandler(
      dbService,
      this.person,
      this.company,
      this.character,
      i18nService
    )
    this.movie = new MovieIngestPersistHandler(
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
export { CompanyIngestPersistHandler } from './company'
export { insertAnimeEpisodeExternalIds, insertAnimeEpisodeRow } from './episodes'
export { GameIngestPersistHandler } from './game'
export { MovieIngestPersistHandler } from './movie'
export { PersonIngestPersistHandler } from './person'
export { TvIngestPersistHandler } from './tv'
export {
  insertTvEpisodeExternalIds,
  insertTvEpisodeRow,
  insertTvSeasonRow,
  insertTvSeasonsAndEpisodes
} from './tv-episodes'
export * from './types'

import type { DbService } from '@main/services/db'
import type { I18nService } from '@main/services/i18n'
import { CharacterIngestPersistHandler } from './character'
import { CompanyIngestPersistHandler } from './company'
import { GameIngestPersistHandler } from './game'
import { PersonIngestPersistHandler } from './person'

export class IngestPersistHandlers {
  readonly person: PersonIngestPersistHandler
  readonly company: CompanyIngestPersistHandler
  readonly character: CharacterIngestPersistHandler
  readonly game: GameIngestPersistHandler

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
  }
}

export { CharacterIngestPersistHandler } from './character'
export { CompanyIngestPersistHandler } from './company'
export { GameIngestPersistHandler } from './game'
export { PersonIngestPersistHandler } from './person'
export * from './types'

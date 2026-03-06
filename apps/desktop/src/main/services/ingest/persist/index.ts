import type { DbService } from '@main/services/db'
import { CharacterIngestPersistHandler } from './character'
import { CompanyIngestPersistHandler } from './company'
import { GameIngestPersistHandler } from './game'
import { PersonIngestPersistHandler } from './person'

export class IngestPersistHandlers {
  readonly person: PersonIngestPersistHandler
  readonly company: CompanyIngestPersistHandler
  readonly character: CharacterIngestPersistHandler
  readonly game: GameIngestPersistHandler

  constructor(dbService: DbService) {
    this.person = new PersonIngestPersistHandler(dbService)
    this.company = new CompanyIngestPersistHandler(dbService)
    this.character = new CharacterIngestPersistHandler(dbService, this.person)
    this.game = new GameIngestPersistHandler(dbService, this.person, this.company, this.character)
  }
}

export { CharacterIngestPersistHandler } from './character'
export { CompanyIngestPersistHandler } from './company'
export { GameIngestPersistHandler } from './game'
export { PersonIngestPersistHandler } from './person'
export * from './types'

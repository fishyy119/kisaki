import { relations } from 'drizzle-orm'

import {
  characterExternalIds,
  characters,
  companies,
  companyExternalIds,
  gameExternalIds,
  games,
  personExternalIds,
  persons
} from '../tables'

export const gameExternalIdsRelations = relations(gameExternalIds, ({ one }) => ({
  game: one(games, {
    fields: [gameExternalIds.gameId],
    references: [games.id]
  })
}))

export const personExternalIdsRelations = relations(personExternalIds, ({ one }) => ({
  person: one(persons, {
    fields: [personExternalIds.personId],
    references: [persons.id]
  })
}))

export const companyExternalIdsRelations = relations(companyExternalIds, ({ one }) => ({
  company: one(companies, {
    fields: [companyExternalIds.companyId],
    references: [companies.id]
  })
}))

export const characterExternalIdsRelations = relations(characterExternalIds, ({ one }) => ({
  character: one(characters, {
    fields: [characterExternalIds.characterId],
    references: [characters.id]
  })
}))

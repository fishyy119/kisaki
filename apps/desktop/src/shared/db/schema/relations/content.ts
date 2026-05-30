import { relations } from 'drizzle-orm'

import {
  characterExternalIds,
  characterPersonLinks,
  characterTagLinks,
  characters,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  companies,
  companyExternalIds,
  companyTagLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gameExternalIds,
  gameNotes,
  gamePersonLinks,
  games,
  gameSessions,
  gameTagLinks,
  personExternalIds,
  persons,
  personTagLinks
} from '../tables'

export const gamesRelations = relations(games, ({ many }) => ({
  sessions: many(gameSessions),
  notes: many(gameNotes),
  gamePersonLinks: many(gamePersonLinks),
  gameCompanyLinks: many(gameCompanyLinks),
  gameCharacterLinks: many(gameCharacterLinks),
  collectionGameLinks: many(collectionGameLinks),
  gameTagLinks: many(gameTagLinks),
  externalIds: many(gameExternalIds)
}))

export const gameNotesRelations = relations(gameNotes, ({ one }) => ({
  game: one(games, {
    fields: [gameNotes.gameId],
    references: [games.id]
  })
}))

export const gameSessionsRelations = relations(gameSessions, ({ one }) => ({
  game: one(games, {
    fields: [gameSessions.gameId],
    references: [games.id]
  })
}))

export const personsRelations = relations(persons, ({ many }) => ({
  gamePersonLinks: many(gamePersonLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionPersonLinks: many(collectionPersonLinks),
  personTagLinks: many(personTagLinks),
  externalIds: many(personExternalIds)
}))

export const companiesRelations = relations(companies, ({ many }) => ({
  gameCompanyLinks: many(gameCompanyLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  companyTagLinks: many(companyTagLinks),
  externalIds: many(companyExternalIds)
}))

export const charactersRelations = relations(characters, ({ many }) => ({
  gameCharacterLinks: many(gameCharacterLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  characterTagLinks: many(characterTagLinks),
  externalIds: many(characterExternalIds)
}))

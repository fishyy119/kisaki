import { relations } from 'drizzle-orm'

import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animeEpisodes,
  animeExternalIds,
  animeExtras,
  animeNotes,
  animePersonLinks,
  animeSessions,
  animeTagLinks,
  animes,
  characterExternalIds,
  characterPersonLinks,
  characterTagLinks,
  characters,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  companies,
  companyExternalIds,
  companyTagLinks,
  gameCastLinks,
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
  gameCastLinks: many(gameCastLinks),
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

export const animesRelations = relations(animes, ({ many }) => ({
  episodes: many(animeEpisodes),
  extras: many(animeExtras),
  sessions: many(animeSessions),
  notes: many(animeNotes),
  animePersonLinks: many(animePersonLinks),
  animeCompanyLinks: many(animeCompanyLinks),
  animeCharacterLinks: many(animeCharacterLinks),
  animeCastLinks: many(animeCastLinks),
  collectionAnimeLinks: many(collectionAnimeLinks),
  animeTagLinks: many(animeTagLinks),
  externalIds: many(animeExternalIds)
}))

export const animeNotesRelations = relations(animeNotes, ({ one }) => ({
  anime: one(animes, {
    fields: [animeNotes.animeId],
    references: [animes.id]
  })
}))

export const personsRelations = relations(persons, ({ many }) => ({
  gamePersonLinks: many(gamePersonLinks),
  animePersonLinks: many(animePersonLinks),
  gameCastLinks: many(gameCastLinks),
  animeCastLinks: many(animeCastLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionPersonLinks: many(collectionPersonLinks),
  personTagLinks: many(personTagLinks),
  externalIds: many(personExternalIds)
}))

export const companiesRelations = relations(companies, ({ many }) => ({
  gameCompanyLinks: many(gameCompanyLinks),
  animeCompanyLinks: many(animeCompanyLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  companyTagLinks: many(companyTagLinks),
  externalIds: many(companyExternalIds)
}))

export const charactersRelations = relations(characters, ({ many }) => ({
  gameCharacterLinks: many(gameCharacterLinks),
  animeCharacterLinks: many(animeCharacterLinks),
  gameCastLinks: many(gameCastLinks),
  animeCastLinks: many(animeCastLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  characterTagLinks: many(characterTagLinks),
  externalIds: many(characterExternalIds)
}))

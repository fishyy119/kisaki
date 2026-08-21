import { relations } from 'drizzle-orm'

import {
  animeEpisodeExternalIds,
  animeEpisodes,
  animeExternalIds,
  animes,
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

export const animeExternalIdsRelations = relations(animeExternalIds, ({ one }) => ({
  anime: one(animes, {
    fields: [animeExternalIds.animeId],
    references: [animes.id]
  })
}))

export const animeEpisodeExternalIdsRelations = relations(animeEpisodeExternalIds, ({ one }) => ({
  episode: one(animeEpisodes, {
    fields: [animeEpisodeExternalIds.episodeId],
    references: [animeEpisodes.id]
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

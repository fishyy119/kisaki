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
  movieExternalIds,
  movies,
  personExternalIds,
  persons,
  tvEpisodeExternalIds,
  tvEpisodes,
  tvExternalIds,
  tvs
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

export const tvExternalIdsRelations = relations(tvExternalIds, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvExternalIds.tvId],
    references: [tvs.id]
  })
}))

export const tvEpisodeExternalIdsRelations = relations(tvEpisodeExternalIds, ({ one }) => ({
  episode: one(tvEpisodes, {
    fields: [tvEpisodeExternalIds.episodeId],
    references: [tvEpisodes.id]
  })
}))

export const movieExternalIdsRelations = relations(movieExternalIds, ({ one }) => ({
  movie: one(movies, {
    fields: [movieExternalIds.movieId],
    references: [movies.id]
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

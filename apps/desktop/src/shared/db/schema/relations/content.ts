import { relations } from 'drizzle-orm'

import {
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
  collectionMovieLinks,
  collectionPersonLinks,
  collectionTvLinks,
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
  movieCharacterLinks,
  movieCompanyLinks,
  movieExternalIds,
  movieExtras,
  movieFiles,
  movieNotes,
  moviePersonLinks,
  movies,
  movieSessions,
  movieTagLinks,
  personExternalIds,
  persons,
  personTagLinks,
  tvCharacterLinks,
  tvCompanyLinks,
  tvEpisodes,
  tvExternalIds,
  tvExtras,
  tvNotes,
  tvPersonLinks,
  tvs,
  tvSeasons,
  tvSessions,
  tvTagLinks
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

export const animesRelations = relations(animes, ({ many }) => ({
  episodes: many(animeEpisodes),
  extras: many(animeExtras),
  sessions: many(animeSessions),
  notes: many(animeNotes),
  animePersonLinks: many(animePersonLinks),
  animeCompanyLinks: many(animeCompanyLinks),
  animeCharacterLinks: many(animeCharacterLinks),
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

export const tvsRelations = relations(tvs, ({ many }) => ({
  seasons: many(tvSeasons),
  episodes: many(tvEpisodes),
  extras: many(tvExtras),
  sessions: many(tvSessions),
  notes: many(tvNotes),
  tvPersonLinks: many(tvPersonLinks),
  tvCompanyLinks: many(tvCompanyLinks),
  tvCharacterLinks: many(tvCharacterLinks),
  collectionTvLinks: many(collectionTvLinks),
  tvTagLinks: many(tvTagLinks),
  externalIds: many(tvExternalIds)
}))

export const tvNotesRelations = relations(tvNotes, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvNotes.tvId],
    references: [tvs.id]
  })
}))

export const moviesRelations = relations(movies, ({ many }) => ({
  files: many(movieFiles),
  extras: many(movieExtras),
  sessions: many(movieSessions),
  notes: many(movieNotes),
  moviePersonLinks: many(moviePersonLinks),
  movieCompanyLinks: many(movieCompanyLinks),
  movieCharacterLinks: many(movieCharacterLinks),
  collectionMovieLinks: many(collectionMovieLinks),
  movieTagLinks: many(movieTagLinks),
  externalIds: many(movieExternalIds)
}))

export const movieNotesRelations = relations(movieNotes, ({ one }) => ({
  movie: one(movies, {
    fields: [movieNotes.movieId],
    references: [movies.id]
  })
}))

export const personsRelations = relations(persons, ({ many }) => ({
  gamePersonLinks: many(gamePersonLinks),
  animePersonLinks: many(animePersonLinks),
  tvPersonLinks: many(tvPersonLinks),
  moviePersonLinks: many(moviePersonLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionPersonLinks: many(collectionPersonLinks),
  personTagLinks: many(personTagLinks),
  externalIds: many(personExternalIds)
}))

export const companiesRelations = relations(companies, ({ many }) => ({
  gameCompanyLinks: many(gameCompanyLinks),
  animeCompanyLinks: many(animeCompanyLinks),
  tvCompanyLinks: many(tvCompanyLinks),
  movieCompanyLinks: many(movieCompanyLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  companyTagLinks: many(companyTagLinks),
  externalIds: many(companyExternalIds)
}))

export const charactersRelations = relations(characters, ({ many }) => ({
  gameCharacterLinks: many(gameCharacterLinks),
  animeCharacterLinks: many(animeCharacterLinks),
  tvCharacterLinks: many(tvCharacterLinks),
  movieCharacterLinks: many(movieCharacterLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  characterTagLinks: many(characterTagLinks),
  externalIds: many(characterExternalIds)
}))

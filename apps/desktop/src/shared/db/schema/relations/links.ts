import { relations } from 'drizzle-orm'

import {
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animes,
  characterPersonLinks,
  characters,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionMovieLinks,
  collectionPersonLinks,
  collections,
  collectionTvLinks,
  companies,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  games,
  movieCharacterLinks,
  movieCompanyLinks,
  moviePersonLinks,
  movies,
  persons,
  tvCharacterLinks,
  tvCompanyLinks,
  tvPersonLinks,
  tvs
} from '../tables'

export const gamePersonLinksRelations = relations(gamePersonLinks, ({ one }) => ({
  game: one(games, {
    fields: [gamePersonLinks.gameId],
    references: [games.id]
  }),
  person: one(persons, {
    fields: [gamePersonLinks.personId],
    references: [persons.id]
  })
}))

export const gameCompanyLinksRelations = relations(gameCompanyLinks, ({ one }) => ({
  game: one(games, {
    fields: [gameCompanyLinks.gameId],
    references: [games.id]
  }),
  company: one(companies, {
    fields: [gameCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const gameCharacterLinksRelations = relations(gameCharacterLinks, ({ one }) => ({
  game: one(games, {
    fields: [gameCharacterLinks.gameId],
    references: [games.id]
  }),
  character: one(characters, {
    fields: [gameCharacterLinks.characterId],
    references: [characters.id]
  })
}))

export const animePersonLinksRelations = relations(animePersonLinks, ({ one }) => ({
  anime: one(animes, {
    fields: [animePersonLinks.animeId],
    references: [animes.id]
  }),
  person: one(persons, {
    fields: [animePersonLinks.personId],
    references: [persons.id]
  })
}))

export const animeCompanyLinksRelations = relations(animeCompanyLinks, ({ one }) => ({
  anime: one(animes, {
    fields: [animeCompanyLinks.animeId],
    references: [animes.id]
  }),
  company: one(companies, {
    fields: [animeCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const animeCharacterLinksRelations = relations(animeCharacterLinks, ({ one }) => ({
  anime: one(animes, {
    fields: [animeCharacterLinks.animeId],
    references: [animes.id]
  }),
  character: one(characters, {
    fields: [animeCharacterLinks.characterId],
    references: [characters.id]
  })
}))

export const tvPersonLinksRelations = relations(tvPersonLinks, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvPersonLinks.tvId],
    references: [tvs.id]
  }),
  person: one(persons, {
    fields: [tvPersonLinks.personId],
    references: [persons.id]
  })
}))

export const tvCompanyLinksRelations = relations(tvCompanyLinks, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvCompanyLinks.tvId],
    references: [tvs.id]
  }),
  company: one(companies, {
    fields: [tvCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const tvCharacterLinksRelations = relations(tvCharacterLinks, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvCharacterLinks.tvId],
    references: [tvs.id]
  }),
  character: one(characters, {
    fields: [tvCharacterLinks.characterId],
    references: [characters.id]
  })
}))

export const moviePersonLinksRelations = relations(moviePersonLinks, ({ one }) => ({
  movie: one(movies, {
    fields: [moviePersonLinks.movieId],
    references: [movies.id]
  }),
  person: one(persons, {
    fields: [moviePersonLinks.personId],
    references: [persons.id]
  })
}))

export const movieCompanyLinksRelations = relations(movieCompanyLinks, ({ one }) => ({
  movie: one(movies, {
    fields: [movieCompanyLinks.movieId],
    references: [movies.id]
  }),
  company: one(companies, {
    fields: [movieCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const movieCharacterLinksRelations = relations(movieCharacterLinks, ({ one }) => ({
  movie: one(movies, {
    fields: [movieCharacterLinks.movieId],
    references: [movies.id]
  }),
  character: one(characters, {
    fields: [movieCharacterLinks.characterId],
    references: [characters.id]
  })
}))

export const collectionTvLinksRelations = relations(collectionTvLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionTvLinks.collectionId],
    references: [collections.id]
  }),
  tv: one(tvs, {
    fields: [collectionTvLinks.tvId],
    references: [tvs.id]
  })
}))

export const collectionMovieLinksRelations = relations(collectionMovieLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionMovieLinks.collectionId],
    references: [collections.id]
  }),
  movie: one(movies, {
    fields: [collectionMovieLinks.movieId],
    references: [movies.id]
  })
}))

export const collectionAnimeLinksRelations = relations(collectionAnimeLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionAnimeLinks.collectionId],
    references: [collections.id]
  }),
  anime: one(animes, {
    fields: [collectionAnimeLinks.animeId],
    references: [animes.id]
  })
}))

export const collectionGameLinksRelations = relations(collectionGameLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionGameLinks.collectionId],
    references: [collections.id]
  }),
  game: one(games, {
    fields: [collectionGameLinks.gameId],
    references: [games.id]
  })
}))

export const collectionCharacterLinksRelations = relations(collectionCharacterLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionCharacterLinks.collectionId],
    references: [collections.id]
  }),
  character: one(characters, {
    fields: [collectionCharacterLinks.characterId],
    references: [characters.id]
  })
}))

export const collectionPersonLinksRelations = relations(collectionPersonLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionPersonLinks.collectionId],
    references: [collections.id]
  }),
  person: one(persons, {
    fields: [collectionPersonLinks.personId],
    references: [persons.id]
  })
}))

export const collectionCompanyLinksRelations = relations(collectionCompanyLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionCompanyLinks.collectionId],
    references: [collections.id]
  }),
  company: one(companies, {
    fields: [collectionCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const characterPersonLinksRelations = relations(characterPersonLinks, ({ one }) => ({
  character: one(characters, {
    fields: [characterPersonLinks.characterId],
    references: [characters.id]
  }),
  person: one(persons, {
    fields: [characterPersonLinks.personId],
    references: [persons.id]
  })
}))

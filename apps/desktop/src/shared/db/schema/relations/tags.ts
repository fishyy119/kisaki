import { relations } from 'drizzle-orm'

import {
  animeTagLinks,
  animes,
  characterTagLinks,
  characters,
  companies,
  companyTagLinks,
  gameTagLinks,
  games,
  movies,
  movieTagLinks,
  persons,
  personTagLinks,
  tags,
  tvs,
  tvTagLinks
} from '../tables'

export const tagsRelations = relations(tags, ({ many }) => ({
  gameTagLinks: many(gameTagLinks),
  animeTagLinks: many(animeTagLinks),
  tvTagLinks: many(tvTagLinks),
  movieTagLinks: many(movieTagLinks),
  characterTagLinks: many(characterTagLinks),
  personTagLinks: many(personTagLinks),
  companyTagLinks: many(companyTagLinks)
}))

export const tvTagLinksRelations = relations(tvTagLinks, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvTagLinks.tvId],
    references: [tvs.id]
  }),
  tag: one(tags, {
    fields: [tvTagLinks.tagId],
    references: [tags.id]
  })
}))

export const movieTagLinksRelations = relations(movieTagLinks, ({ one }) => ({
  movie: one(movies, {
    fields: [movieTagLinks.movieId],
    references: [movies.id]
  }),
  tag: one(tags, {
    fields: [movieTagLinks.tagId],
    references: [tags.id]
  })
}))

export const animeTagLinksRelations = relations(animeTagLinks, ({ one }) => ({
  anime: one(animes, {
    fields: [animeTagLinks.animeId],
    references: [animes.id]
  }),
  tag: one(tags, {
    fields: [animeTagLinks.tagId],
    references: [tags.id]
  })
}))

export const gameTagLinksRelations = relations(gameTagLinks, ({ one }) => ({
  game: one(games, {
    fields: [gameTagLinks.gameId],
    references: [games.id]
  }),
  tag: one(tags, {
    fields: [gameTagLinks.tagId],
    references: [tags.id]
  })
}))

export const characterTagLinksRelations = relations(characterTagLinks, ({ one }) => ({
  character: one(characters, {
    fields: [characterTagLinks.characterId],
    references: [characters.id]
  }),
  tag: one(tags, {
    fields: [characterTagLinks.tagId],
    references: [tags.id]
  })
}))

export const personTagLinksRelations = relations(personTagLinks, ({ one }) => ({
  person: one(persons, {
    fields: [personTagLinks.personId],
    references: [persons.id]
  }),
  tag: one(tags, {
    fields: [personTagLinks.tagId],
    references: [tags.id]
  })
}))

export const companyTagLinksRelations = relations(companyTagLinks, ({ one }) => ({
  company: one(companies, {
    fields: [companyTagLinks.companyId],
    references: [companies.id]
  }),
  tag: one(tags, {
    fields: [companyTagLinks.tagId],
    references: [tags.id]
  })
}))

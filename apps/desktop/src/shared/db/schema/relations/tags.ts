import { relations } from 'drizzle-orm'

import {
  characterTagLinks,
  characters,
  companies,
  companyTagLinks,
  gameTagLinks,
  games,
  persons,
  personTagLinks,
  tags
} from '../tables'

export const tagsRelations = relations(tags, ({ many }) => ({
  gameTagLinks: many(gameTagLinks),
  characterTagLinks: many(characterTagLinks),
  personTagLinks: many(personTagLinks),
  companyTagLinks: many(companyTagLinks)
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

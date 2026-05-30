import { relations } from 'drizzle-orm'

import {
  characterPersonLinks,
  characters,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  collections,
  companies,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  games,
  persons
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

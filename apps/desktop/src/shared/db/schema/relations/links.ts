import { relations } from 'drizzle-orm'

import {
  animeCastLinks,
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animes,
  characterPersonLinks,
  characters,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  collections,
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  comics,
  companies,
  gameCastLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  games,
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks,
  novels,
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

export const gameCastLinksRelations = relations(gameCastLinks, ({ one }) => ({
  game: one(games, {
    fields: [gameCastLinks.gameId],
    references: [games.id]
  }),
  character: one(characters, {
    fields: [gameCastLinks.characterId],
    references: [characters.id]
  }),
  person: one(persons, {
    fields: [gameCastLinks.personId],
    references: [persons.id]
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

export const animeCastLinksRelations = relations(animeCastLinks, ({ one }) => ({
  anime: one(animes, {
    fields: [animeCastLinks.animeId],
    references: [animes.id]
  }),
  character: one(characters, {
    fields: [animeCastLinks.characterId],
    references: [characters.id]
  }),
  person: one(persons, {
    fields: [animeCastLinks.personId],
    references: [persons.id]
  })
}))

export const comicPersonLinksRelations = relations(comicPersonLinks, ({ one }) => ({
  comic: one(comics, {
    fields: [comicPersonLinks.comicId],
    references: [comics.id]
  }),
  person: one(persons, {
    fields: [comicPersonLinks.personId],
    references: [persons.id]
  })
}))

export const comicCompanyLinksRelations = relations(comicCompanyLinks, ({ one }) => ({
  comic: one(comics, {
    fields: [comicCompanyLinks.comicId],
    references: [comics.id]
  }),
  company: one(companies, {
    fields: [comicCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const comicCharacterLinksRelations = relations(comicCharacterLinks, ({ one }) => ({
  comic: one(comics, {
    fields: [comicCharacterLinks.comicId],
    references: [comics.id]
  }),
  character: one(characters, {
    fields: [comicCharacterLinks.characterId],
    references: [characters.id]
  })
}))

export const novelPersonLinksRelations = relations(novelPersonLinks, ({ one }) => ({
  novel: one(novels, {
    fields: [novelPersonLinks.novelId],
    references: [novels.id]
  }),
  person: one(persons, {
    fields: [novelPersonLinks.personId],
    references: [persons.id]
  })
}))

export const novelCompanyLinksRelations = relations(novelCompanyLinks, ({ one }) => ({
  novel: one(novels, {
    fields: [novelCompanyLinks.novelId],
    references: [novels.id]
  }),
  company: one(companies, {
    fields: [novelCompanyLinks.companyId],
    references: [companies.id]
  })
}))

export const novelCharacterLinksRelations = relations(novelCharacterLinks, ({ one }) => ({
  novel: one(novels, {
    fields: [novelCharacterLinks.novelId],
    references: [novels.id]
  }),
  character: one(characters, {
    fields: [novelCharacterLinks.characterId],
    references: [characters.id]
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

export const collectionComicLinksRelations = relations(collectionComicLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionComicLinks.collectionId],
    references: [collections.id]
  }),
  comic: one(comics, {
    fields: [collectionComicLinks.comicId],
    references: [comics.id]
  })
}))

export const collectionNovelLinksRelations = relations(collectionNovelLinks, ({ one }) => ({
  collection: one(collections, {
    fields: [collectionNovelLinks.collectionId],
    references: [collections.id]
  }),
  novel: one(novels, {
    fields: [collectionNovelLinks.novelId],
    references: [novels.id]
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

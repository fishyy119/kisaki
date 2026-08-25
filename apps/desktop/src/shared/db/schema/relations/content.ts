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
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  comicChapters,
  comicCharacterLinks,
  comicCompanyLinks,
  comicExternalIds,
  comicNotes,
  comicPersonLinks,
  comicSessions,
  comicTagLinks,
  comics,
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
  novelCharacterLinks,
  novelCompanyLinks,
  novelExternalIds,
  novelNotes,
  novelPersonLinks,
  novelSessions,
  novelTagLinks,
  novelVolumes,
  novels,
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

export const comicsRelations = relations(comics, ({ many }) => ({
  chapters: many(comicChapters),
  sessions: many(comicSessions),
  notes: many(comicNotes),
  comicPersonLinks: many(comicPersonLinks),
  comicCompanyLinks: many(comicCompanyLinks),
  comicCharacterLinks: many(comicCharacterLinks),
  collectionComicLinks: many(collectionComicLinks),
  comicTagLinks: many(comicTagLinks),
  externalIds: many(comicExternalIds)
}))

export const comicNotesRelations = relations(comicNotes, ({ one }) => ({
  comic: one(comics, {
    fields: [comicNotes.comicId],
    references: [comics.id]
  })
}))

export const novelsRelations = relations(novels, ({ many }) => ({
  volumes: many(novelVolumes),
  sessions: many(novelSessions),
  notes: many(novelNotes),
  novelPersonLinks: many(novelPersonLinks),
  novelCompanyLinks: many(novelCompanyLinks),
  novelCharacterLinks: many(novelCharacterLinks),
  collectionNovelLinks: many(collectionNovelLinks),
  novelTagLinks: many(novelTagLinks),
  externalIds: many(novelExternalIds)
}))

export const novelNotesRelations = relations(novelNotes, ({ one }) => ({
  novel: one(novels, {
    fields: [novelNotes.novelId],
    references: [novels.id]
  })
}))

export const personsRelations = relations(persons, ({ many }) => ({
  gamePersonLinks: many(gamePersonLinks),
  animePersonLinks: many(animePersonLinks),
  comicPersonLinks: many(comicPersonLinks),
  novelPersonLinks: many(novelPersonLinks),
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
  comicCompanyLinks: many(comicCompanyLinks),
  novelCompanyLinks: many(novelCompanyLinks),
  collectionCompanyLinks: many(collectionCompanyLinks),
  companyTagLinks: many(companyTagLinks),
  externalIds: many(companyExternalIds)
}))

export const charactersRelations = relations(characters, ({ many }) => ({
  gameCharacterLinks: many(gameCharacterLinks),
  animeCharacterLinks: many(animeCharacterLinks),
  comicCharacterLinks: many(comicCharacterLinks),
  novelCharacterLinks: many(novelCharacterLinks),
  gameCastLinks: many(gameCastLinks),
  animeCastLinks: many(animeCastLinks),
  characterPersonLinks: many(characterPersonLinks),
  collectionCharacterLinks: many(collectionCharacterLinks),
  characterTagLinks: many(characterTagLinks),
  externalIds: many(characterExternalIds)
}))

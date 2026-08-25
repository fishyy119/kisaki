import { relations } from 'drizzle-orm'

import {
  animeEpisodeExternalIds,
  animeEpisodes,
  animeExternalIds,
  animes,
  characterExternalIds,
  characters,
  comicChapterExternalIds,
  comicChapters,
  comicExternalIds,
  comics,
  companies,
  companyExternalIds,
  gameExternalIds,
  games,
  novelExternalIds,
  novelVolumeExternalIds,
  novelVolumes,
  novels,
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

export const comicExternalIdsRelations = relations(comicExternalIds, ({ one }) => ({
  comic: one(comics, {
    fields: [comicExternalIds.comicId],
    references: [comics.id]
  })
}))

export const comicChapterExternalIdsRelations = relations(comicChapterExternalIds, ({ one }) => ({
  chapter: one(comicChapters, {
    fields: [comicChapterExternalIds.chapterId],
    references: [comicChapters.id]
  })
}))

export const novelExternalIdsRelations = relations(novelExternalIds, ({ one }) => ({
  novel: one(novels, {
    fields: [novelExternalIds.novelId],
    references: [novels.id]
  })
}))

export const novelVolumeExternalIdsRelations = relations(novelVolumeExternalIds, ({ one }) => ({
  volume: one(novelVolumes, {
    fields: [novelVolumeExternalIds.volumeId],
    references: [novelVolumes.id]
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

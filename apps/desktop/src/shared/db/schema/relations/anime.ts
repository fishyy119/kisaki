import { relations } from 'drizzle-orm'

import {
  animeEpisodeExternalIds,
  animeEpisodeFiles,
  animeEpisodes,
  animeExtraFiles,
  animeExtras,
  animeSessions,
  animes
} from '../tables'

export const animeEpisodesRelations = relations(animeEpisodes, ({ one, many }) => ({
  anime: one(animes, {
    fields: [animeEpisodes.animeId],
    references: [animes.id]
  }),
  files: many(animeEpisodeFiles),
  sessions: many(animeSessions),
  externalIds: many(animeEpisodeExternalIds)
}))

export const animeEpisodeFilesRelations = relations(animeEpisodeFiles, ({ one }) => ({
  episode: one(animeEpisodes, {
    fields: [animeEpisodeFiles.episodeId],
    references: [animeEpisodes.id]
  })
}))

export const animeExtrasRelations = relations(animeExtras, ({ one, many }) => ({
  anime: one(animes, {
    fields: [animeExtras.animeId],
    references: [animes.id]
  }),
  files: many(animeExtraFiles)
}))

export const animeExtraFilesRelations = relations(animeExtraFiles, ({ one }) => ({
  extra: one(animeExtras, {
    fields: [animeExtraFiles.extraId],
    references: [animeExtras.id]
  })
}))

export const animeSessionsRelations = relations(animeSessions, ({ one }) => ({
  anime: one(animes, {
    fields: [animeSessions.animeId],
    references: [animes.id]
  }),
  episode: one(animeEpisodes, {
    fields: [animeSessions.episodeId],
    references: [animeEpisodes.id]
  })
}))

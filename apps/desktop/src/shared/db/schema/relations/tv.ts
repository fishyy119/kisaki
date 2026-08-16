import { relations } from 'drizzle-orm'

import {
  tvEpisodeExternalIds,
  tvEpisodeFiles,
  tvEpisodes,
  tvExtraFiles,
  tvExtras,
  tvSeasons,
  tvSessions,
  tvs
} from '../tables'

export const tvSeasonsRelations = relations(tvSeasons, ({ one, many }) => ({
  tv: one(tvs, {
    fields: [tvSeasons.tvId],
    references: [tvs.id]
  }),
  episodes: many(tvEpisodes)
}))

export const tvEpisodesRelations = relations(tvEpisodes, ({ one, many }) => ({
  tv: one(tvs, {
    fields: [tvEpisodes.tvId],
    references: [tvs.id]
  }),
  season: one(tvSeasons, {
    fields: [tvEpisodes.seasonId],
    references: [tvSeasons.id]
  }),
  files: many(tvEpisodeFiles),
  sessions: many(tvSessions),
  externalIds: many(tvEpisodeExternalIds)
}))

export const tvEpisodeFilesRelations = relations(tvEpisodeFiles, ({ one }) => ({
  episode: one(tvEpisodes, {
    fields: [tvEpisodeFiles.episodeId],
    references: [tvEpisodes.id]
  })
}))

export const tvExtrasRelations = relations(tvExtras, ({ one, many }) => ({
  tv: one(tvs, {
    fields: [tvExtras.tvId],
    references: [tvs.id]
  }),
  files: many(tvExtraFiles)
}))

export const tvExtraFilesRelations = relations(tvExtraFiles, ({ one }) => ({
  extra: one(tvExtras, {
    fields: [tvExtraFiles.extraId],
    references: [tvExtras.id]
  })
}))

export const tvSessionsRelations = relations(tvSessions, ({ one }) => ({
  tv: one(tvs, {
    fields: [tvSessions.tvId],
    references: [tvs.id]
  }),
  episode: one(tvEpisodes, {
    fields: [tvSessions.episodeId],
    references: [tvEpisodes.id]
  })
}))

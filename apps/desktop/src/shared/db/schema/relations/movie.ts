import { relations } from 'drizzle-orm'

import { movieExtraFiles, movieExtras, movieFiles, movieSessions, movies } from '../tables'

export const movieFilesRelations = relations(movieFiles, ({ one }) => ({
  movie: one(movies, {
    fields: [movieFiles.movieId],
    references: [movies.id]
  })
}))

export const movieExtrasRelations = relations(movieExtras, ({ one, many }) => ({
  movie: one(movies, {
    fields: [movieExtras.movieId],
    references: [movies.id]
  }),
  files: many(movieExtraFiles)
}))

export const movieExtraFilesRelations = relations(movieExtraFiles, ({ one }) => ({
  extra: one(movieExtras, {
    fields: [movieExtraFiles.extraId],
    references: [movieExtras.id]
  })
}))

export const movieSessionsRelations = relations(movieSessions, ({ one }) => ({
  movie: one(movies, {
    fields: [movieSessions.movieId],
    references: [movies.id]
  })
}))

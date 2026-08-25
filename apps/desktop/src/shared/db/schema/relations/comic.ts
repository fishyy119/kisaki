import { relations } from 'drizzle-orm'

import {
  comicChapterExternalIds,
  comicChapterFiles,
  comicChapters,
  comicSessions,
  comics
} from '../tables'

export const comicChaptersRelations = relations(comicChapters, ({ one, many }) => ({
  comic: one(comics, {
    fields: [comicChapters.comicId],
    references: [comics.id]
  }),
  files: many(comicChapterFiles),
  sessions: many(comicSessions),
  externalIds: many(comicChapterExternalIds)
}))

export const comicChapterFilesRelations = relations(comicChapterFiles, ({ one }) => ({
  chapter: one(comicChapters, {
    fields: [comicChapterFiles.chapterId],
    references: [comicChapters.id]
  })
}))

export const comicSessionsRelations = relations(comicSessions, ({ one }) => ({
  comic: one(comics, {
    fields: [comicSessions.comicId],
    references: [comics.id]
  }),
  chapter: one(comicChapters, {
    fields: [comicSessions.chapterId],
    references: [comicChapters.id]
  })
}))

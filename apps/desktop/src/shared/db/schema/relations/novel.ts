import { relations } from 'drizzle-orm'

import {
  novelSessions,
  novelVolumeExternalIds,
  novelVolumeFiles,
  novelVolumes,
  novels
} from '../tables'

export const novelVolumesRelations = relations(novelVolumes, ({ one, many }) => ({
  novel: one(novels, {
    fields: [novelVolumes.novelId],
    references: [novels.id]
  }),
  files: many(novelVolumeFiles),
  sessions: many(novelSessions),
  externalIds: many(novelVolumeExternalIds)
}))

export const novelVolumeFilesRelations = relations(novelVolumeFiles, ({ one }) => ({
  volume: one(novelVolumes, {
    fields: [novelVolumeFiles.volumeId],
    references: [novelVolumes.id]
  })
}))

export const novelSessionsRelations = relations(novelSessions, ({ one }) => ({
  novel: one(novels, {
    fields: [novelSessions.novelId],
    references: [novels.id]
  }),
  volume: one(novelVolumes, {
    fields: [novelSessions.volumeId],
    references: [novelVolumes.id]
  })
}))

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { baseColumns } from '../../columns'
import { games } from './content'

export const gameSessions = sqliteTable(
  'game_sessions',
  {
    ...baseColumns,
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => [
    index('idx_game_sessions_game_id').on(t.gameId),
    index('idx_game_sessions_started_at').on(t.startedAt)
  ]
)

export type GameSession = InferSelectModel<typeof gameSessions>
export type NewGameSession = InferInsertModel<typeof gameSessions>

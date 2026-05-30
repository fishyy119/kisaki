import { integer, text } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'

export const baseColumns = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
}

import { integer, text } from 'drizzle-orm/sqlite-core'
import { newId } from '@shared/id'

export const baseColumns = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => newId()),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
}

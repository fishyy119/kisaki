import { tags } from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const tagFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'tag',
  table: tags,
  fields: [
    { key: 'isNsfw', kind: 'boolean', column: tags.isNsfw },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: tags.createdAt }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: tags.name },
      { key: 'createdAt', kind: 'column', column: tags.createdAt }
    ]
  }
})

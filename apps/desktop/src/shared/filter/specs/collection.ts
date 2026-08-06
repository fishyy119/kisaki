import { collections } from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const collectionFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'collection',
  table: collections,
  fields: [
    { key: 'isNsfw', kind: 'boolean', column: collections.isNsfw },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: collections.createdAt }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: collections.name },
      { key: 'order', kind: 'column', column: collections.order },
      { key: 'createdAt', kind: 'column', column: collections.createdAt }
    ]
  }
})

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
    // The user's own arrangement is the canonical collection order (the
    // explorer groups and the collections page both walk it).
    defaultKey: 'order',
    fields: [
      { key: 'order', kind: 'column', column: collections.order },
      { key: 'name', kind: 'column', column: collections.name },
      { key: 'createdAt', kind: 'column', column: collections.createdAt }
    ]
  }
})

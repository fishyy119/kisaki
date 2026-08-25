import {
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks,
  novelTagLinks,
  novels,
  collectionNovelLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const novelFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'novel',
  table: novels,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: novels.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: novels.isNsfw },

    { key: 'status', kind: 'enum', column: novels.status },
    { key: 'format', kind: 'enum', column: novels.format },

    { key: 'score', kind: 'number', column: novels.score },
    { key: 'totalDuration', kind: 'number', column: novels.totalDuration },
    { key: 'totalVolumes', kind: 'number', column: novels.totalVolumes },

    { key: 'releaseDate', kind: 'date', mode: 'partialDate', column: novels.releaseDate },
    { key: 'lastActiveAt', kind: 'date', mode: 'timestampMs', column: novels.lastActiveAt },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: novels.createdAt },

    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: novelTagLinks,
        entityIdColumn: novelTagLinks.novelId,
        relatedIdColumn: novelTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionNovelLinks,
        entityIdColumn: collectionNovelLinks.novelId,
        relatedIdColumn: collectionNovelLinks.collectionId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: novelPersonLinks,
        entityIdColumn: novelPersonLinks.novelId,
        relatedIdColumn: novelPersonLinks.personId
      }
    },
    {
      key: 'companies',
      kind: 'relation',
      targetEntity: 'company',
      link: {
        table: novelCompanyLinks,
        entityIdColumn: novelCompanyLinks.novelId,
        relatedIdColumn: novelCompanyLinks.companyId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: novelCharacterLinks,
        entityIdColumn: novelCharacterLinks.novelId,
        relatedIdColumn: novelCharacterLinks.characterId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: novels.name },
      { key: 'sortName', kind: 'column', column: novels.sortName },
      { key: 'originalName', kind: 'column', column: novels.originalName },
      { key: 'lastActiveAt', kind: 'column', column: novels.lastActiveAt },
      { key: 'totalDuration', kind: 'column', column: novels.totalDuration },
      { key: 'createdAt', kind: 'column', column: novels.createdAt },
      { key: 'releaseDate', kind: 'partialDate', column: novels.releaseDate },
      { key: 'score', kind: 'column', column: novels.score }
    ]
  }
})

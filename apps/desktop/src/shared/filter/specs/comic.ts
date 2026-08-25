import {
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  comicTagLinks,
  comics,
  collectionComicLinks
} from '@shared/db'
import { defineFilterQuerySpec } from '../spec'

export const comicFilterQuerySpec = defineFilterQuerySpec({
  entityType: 'comic',
  table: comics,
  fields: [
    { key: 'isFavorite', kind: 'boolean', column: comics.isFavorite },
    { key: 'isNsfw', kind: 'boolean', column: comics.isNsfw },

    { key: 'status', kind: 'enum', column: comics.status },
    { key: 'format', kind: 'enum', column: comics.format },

    { key: 'score', kind: 'number', column: comics.score },
    { key: 'totalDuration', kind: 'number', column: comics.totalDuration },
    { key: 'totalVolumes', kind: 'number', column: comics.totalVolumes },
    { key: 'totalChapters', kind: 'number', column: comics.totalChapters },

    { key: 'releaseDate', kind: 'date', mode: 'partialDate', column: comics.releaseDate },
    { key: 'lastActiveAt', kind: 'date', mode: 'timestampMs', column: comics.lastActiveAt },
    { key: 'createdAt', kind: 'date', mode: 'timestampMs', column: comics.createdAt },

    {
      key: 'tags',
      kind: 'relation',
      targetEntity: 'tag',
      link: {
        table: comicTagLinks,
        entityIdColumn: comicTagLinks.comicId,
        relatedIdColumn: comicTagLinks.tagId
      }
    },
    {
      key: 'collections',
      kind: 'relation',
      targetEntity: 'collection',
      link: {
        table: collectionComicLinks,
        entityIdColumn: collectionComicLinks.comicId,
        relatedIdColumn: collectionComicLinks.collectionId
      }
    },
    {
      key: 'persons',
      kind: 'relation',
      targetEntity: 'person',
      link: {
        table: comicPersonLinks,
        entityIdColumn: comicPersonLinks.comicId,
        relatedIdColumn: comicPersonLinks.personId
      }
    },
    {
      key: 'companies',
      kind: 'relation',
      targetEntity: 'company',
      link: {
        table: comicCompanyLinks,
        entityIdColumn: comicCompanyLinks.comicId,
        relatedIdColumn: comicCompanyLinks.companyId
      }
    },
    {
      key: 'characters',
      kind: 'relation',
      targetEntity: 'character',
      link: {
        table: comicCharacterLinks,
        entityIdColumn: comicCharacterLinks.comicId,
        relatedIdColumn: comicCharacterLinks.characterId
      }
    }
  ],
  sort: {
    defaultKey: 'name',
    fields: [
      { key: 'name', kind: 'column', column: comics.name },
      { key: 'sortName', kind: 'column', column: comics.sortName },
      { key: 'originalName', kind: 'column', column: comics.originalName },
      { key: 'lastActiveAt', kind: 'column', column: comics.lastActiveAt },
      { key: 'totalDuration', kind: 'column', column: comics.totalDuration },
      { key: 'createdAt', kind: 'column', column: comics.createdAt },
      { key: 'releaseDate', kind: 'partialDate', column: comics.releaseDate },
      { key: 'score', kind: 'column', column: comics.score }
    ]
  }
})

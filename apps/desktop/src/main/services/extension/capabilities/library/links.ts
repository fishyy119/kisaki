import type {
  LibraryLink,
  LibraryLinkCreateInput,
  LibraryLinkKind,
  LibraryLinkPatch,
  LibraryLinkQuery,
  LibraryLinkSelector
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  createValidationError,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, eq, or, type SQL } from 'drizzle-orm'
import {
  animeCharacterLinks,
  animeCompanyLinks,
  animePersonLinks,
  animeTagLinks,
  characterPersonLinks,
  characterTagLinks,
  collectionAnimeLinks,
  collectionCharacterLinks,
  collectionComicLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionNovelLinks,
  collectionPersonLinks,
  comicCharacterLinks,
  comicCompanyLinks,
  comicPersonLinks,
  comicTagLinks,
  companyTagLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  gameTagLinks,
  novelCharacterLinks,
  novelCompanyLinks,
  novelPersonLinks,
  novelTagLinks,
  personTagLinks
} from '@shared/db'
import type { DbService } from '@main/services/db'
import type {
  AnySQLiteColumn,
  SQLiteInsertValue,
  SQLiteTable,
  SQLiteUpdateSetSource
} from 'drizzle-orm/sqlite-core'

interface LinkConfig {
  kind: LibraryLinkKind
  table: SQLiteTable
  fromType: string
  toType: string
  fromIdField: string
  toIdField: string
  orderField?: string
  secondaryOrderField?: string
  noteField?: string
  spoilerField?: string
  roleField?: string
}

const LINK_CONFIGS: Record<LibraryLinkKind, LinkConfig> = {
  'game-person': {
    kind: 'game-person',
    table: gamePersonLinks,
    fromType: 'game',
    toType: 'person',
    fromIdField: 'gameId',
    toIdField: 'personId',
    orderField: 'orderInGame',
    secondaryOrderField: 'orderInPerson',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'game-company': {
    kind: 'game-company',
    table: gameCompanyLinks,
    fromType: 'game',
    toType: 'company',
    fromIdField: 'gameId',
    toIdField: 'companyId',
    orderField: 'orderInGame',
    secondaryOrderField: 'orderInCompany',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'game-character': {
    kind: 'game-character',
    table: gameCharacterLinks,
    fromType: 'game',
    toType: 'character',
    fromIdField: 'gameId',
    toIdField: 'characterId',
    orderField: 'orderInGame',
    secondaryOrderField: 'orderInCharacter',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'anime-person': {
    kind: 'anime-person',
    table: animePersonLinks,
    fromType: 'anime',
    toType: 'person',
    fromIdField: 'animeId',
    toIdField: 'personId',
    orderField: 'orderInAnime',
    secondaryOrderField: 'orderInPerson',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'anime-company': {
    kind: 'anime-company',
    table: animeCompanyLinks,
    fromType: 'anime',
    toType: 'company',
    fromIdField: 'animeId',
    toIdField: 'companyId',
    orderField: 'orderInAnime',
    secondaryOrderField: 'orderInCompany',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'anime-character': {
    kind: 'anime-character',
    table: animeCharacterLinks,
    fromType: 'anime',
    toType: 'character',
    fromIdField: 'animeId',
    toIdField: 'characterId',
    orderField: 'orderInAnime',
    secondaryOrderField: 'orderInCharacter',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'comic-person': {
    kind: 'comic-person',
    table: comicPersonLinks,
    fromType: 'comic',
    toType: 'person',
    fromIdField: 'comicId',
    toIdField: 'personId',
    orderField: 'orderInComic',
    secondaryOrderField: 'orderInPerson',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'comic-company': {
    kind: 'comic-company',
    table: comicCompanyLinks,
    fromType: 'comic',
    toType: 'company',
    fromIdField: 'comicId',
    toIdField: 'companyId',
    orderField: 'orderInComic',
    secondaryOrderField: 'orderInCompany',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'comic-character': {
    kind: 'comic-character',
    table: comicCharacterLinks,
    fromType: 'comic',
    toType: 'character',
    fromIdField: 'comicId',
    toIdField: 'characterId',
    orderField: 'orderInComic',
    secondaryOrderField: 'orderInCharacter',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'novel-person': {
    kind: 'novel-person',
    table: novelPersonLinks,
    fromType: 'novel',
    toType: 'person',
    fromIdField: 'novelId',
    toIdField: 'personId',
    orderField: 'orderInNovel',
    secondaryOrderField: 'orderInPerson',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'novel-company': {
    kind: 'novel-company',
    table: novelCompanyLinks,
    fromType: 'novel',
    toType: 'company',
    fromIdField: 'novelId',
    toIdField: 'companyId',
    orderField: 'orderInNovel',
    secondaryOrderField: 'orderInCompany',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'novel-character': {
    kind: 'novel-character',
    table: novelCharacterLinks,
    fromType: 'novel',
    toType: 'character',
    fromIdField: 'novelId',
    toIdField: 'characterId',
    orderField: 'orderInNovel',
    secondaryOrderField: 'orderInCharacter',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'character-person': {
    kind: 'character-person',
    table: characterPersonLinks,
    fromType: 'character',
    toType: 'person',
    fromIdField: 'characterId',
    toIdField: 'personId',
    orderField: 'orderInCharacter',
    secondaryOrderField: 'orderInPerson',
    noteField: 'note',
    spoilerField: 'isSpoiler',
    roleField: 'role'
  },
  'game-tag': {
    kind: 'game-tag',
    table: gameTagLinks,
    fromType: 'game',
    toType: 'tag',
    fromIdField: 'gameId',
    toIdField: 'tagId',
    orderField: 'orderInGame',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'anime-tag': {
    kind: 'anime-tag',
    table: animeTagLinks,
    fromType: 'anime',
    toType: 'tag',
    fromIdField: 'animeId',
    toIdField: 'tagId',
    orderField: 'orderInAnime',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'comic-tag': {
    kind: 'comic-tag',
    table: comicTagLinks,
    fromType: 'comic',
    toType: 'tag',
    fromIdField: 'comicId',
    toIdField: 'tagId',
    orderField: 'orderInComic',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'novel-tag': {
    kind: 'novel-tag',
    table: novelTagLinks,
    fromType: 'novel',
    toType: 'tag',
    fromIdField: 'novelId',
    toIdField: 'tagId',
    orderField: 'orderInNovel',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'character-tag': {
    kind: 'character-tag',
    table: characterTagLinks,
    fromType: 'character',
    toType: 'tag',
    fromIdField: 'characterId',
    toIdField: 'tagId',
    orderField: 'orderInCharacter',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'person-tag': {
    kind: 'person-tag',
    table: personTagLinks,
    fromType: 'person',
    toType: 'tag',
    fromIdField: 'personId',
    toIdField: 'tagId',
    orderField: 'orderInPerson',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'company-tag': {
    kind: 'company-tag',
    table: companyTagLinks,
    fromType: 'company',
    toType: 'tag',
    fromIdField: 'companyId',
    toIdField: 'tagId',
    orderField: 'orderInCompany',
    secondaryOrderField: 'orderInTag',
    noteField: 'note',
    spoilerField: 'isSpoiler'
  },
  'collection-game': {
    kind: 'collection-game',
    table: collectionGameLinks,
    fromType: 'collection',
    toType: 'game',
    fromIdField: 'collectionId',
    toIdField: 'gameId',
    orderField: 'orderInCollection',
    noteField: 'note'
  },
  'collection-anime': {
    kind: 'collection-anime',
    table: collectionAnimeLinks,
    fromType: 'collection',
    toType: 'anime',
    fromIdField: 'collectionId',
    toIdField: 'animeId',
    orderField: 'orderInCollection',
    noteField: 'note'
  },
  'collection-comic': {
    kind: 'collection-comic',
    table: collectionComicLinks,
    fromType: 'collection',
    toType: 'comic',
    fromIdField: 'collectionId',
    toIdField: 'comicId',
    orderField: 'orderInCollection',
    noteField: 'note'
  },
  'collection-novel': {
    kind: 'collection-novel',
    table: collectionNovelLinks,
    fromType: 'collection',
    toType: 'novel',
    fromIdField: 'collectionId',
    toIdField: 'novelId',
    orderField: 'orderInCollection',
    noteField: 'note'
  },
  'collection-character': {
    kind: 'collection-character',
    table: collectionCharacterLinks,
    fromType: 'collection',
    toType: 'character',
    fromIdField: 'collectionId',
    toIdField: 'characterId',
    orderField: 'orderInCollection',
    noteField: 'note'
  },
  'collection-person': {
    kind: 'collection-person',
    table: collectionPersonLinks,
    fromType: 'collection',
    toType: 'person',
    fromIdField: 'collectionId',
    toIdField: 'personId',
    orderField: 'orderInCollection',
    noteField: 'note'
  },
  'collection-company': {
    kind: 'collection-company',
    table: collectionCompanyLinks,
    fromType: 'collection',
    toType: 'company',
    fromIdField: 'collectionId',
    toIdField: 'companyId',
    orderField: 'orderInCollection',
    noteField: 'note'
  }
}

export interface ExtensionLibraryLinkStoreOptions {
  db: DbService
}

export class ExtensionLibraryLinkStore {
  constructor(private readonly options: ExtensionLibraryLinkStoreOptions) {}

  list(query?: LibraryLinkQuery): readonly LibraryLink[] {
    try {
      const kinds = query?.kinds?.length
        ? query.kinds
        : (Object.keys(LINK_CONFIGS) as LibraryLinkKind[])
      const links: LibraryLink[] = []

      for (const kind of kinds) {
        const config = LINK_CONFIGS[kind]
        const condition = buildListCondition(config, query)
        if (condition === null) {
          continue
        }

        const rows = condition
          ? this.options.db.client.select().from(config.table).where(condition).all()
          : this.options.db.client.select().from(config.table).all()

        for (const row of rows) {
          links.push(toLink(config, row))
        }
      }

      return links
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list library links.')
    }
  }

  create<K extends LibraryLinkKind>(input: LibraryLinkCreateInput<K>): LibraryLink<K> {
    const config = LINK_CONFIGS[input.kind]
    validateLinkInput(config, input)

    try {
      this.options.db.client.insert(config.table).values(buildInsertValues(config, input)).run()
      const row = this.selectOne(config, input as unknown as LibraryLinkSelector<LibraryLinkKind>)
      return toLink(config, row) as LibraryLink<K>
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the library link.')
    }
  }

  update<K extends LibraryLinkKind>(
    selector: LibraryLinkSelector<K>,
    patch: LibraryLinkPatch<K>
  ): LibraryLink<K> {
    const config = LINK_CONFIGS[selector.kind]

    try {
      const existing = this.selectOne(
        config,
        selector as unknown as LibraryLinkSelector<LibraryLinkKind>
      )

      const values = buildUpdateValues(config, patch)
      if (Object.keys(values).length === 0) {
        return toLink(config, existing) as LibraryLink<K>
      }

      this.options.db.client
        .update(config.table)
        .set(values)
        .where(buildSelectorCondition(config, selector))
        .run()

      const updatedSelector =
        config.roleField && 'role' in patch && typeof patch.role === 'string'
          ? ({ ...selector, role: patch.role } as LibraryLinkSelector<K>)
          : selector
      const row = this.selectOne(
        config,
        updatedSelector as unknown as LibraryLinkSelector<LibraryLinkKind>
      )
      return toLink(config, row) as LibraryLink<K>
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the library link.')
    }
  }

  remove<K extends LibraryLinkKind>(selector: LibraryLinkSelector<K>): void {
    const config = LINK_CONFIGS[selector.kind]

    try {
      this.selectOne(config, selector as unknown as LibraryLinkSelector<LibraryLinkKind>)
      this.options.db.client
        .delete(config.table)
        .where(
          buildSelectorCondition(
            config,
            selector as unknown as LibraryLinkSelector<LibraryLinkKind>
          )
        )
        .run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the library link.')
    }
  }

  private selectOne(
    config: LinkConfig,
    selector: LibraryLinkSelector<LibraryLinkKind>
  ): Record<string, unknown> {
    const row = this.options.db.client
      .select()
      .from(config.table)
      .where(buildSelectorCondition(config, selector))
      .get()

    if (!row) {
      throw createNotFoundError(`Library link "${selector.kind}" was not found.`)
    }

    return row as Record<string, unknown>
  }
}

function validateLinkInput(
  config: LinkConfig,
  input: LibraryLinkCreateInput<LibraryLinkKind>
): void {
  if (input.from.entityType !== config.fromType || input.to.entityType !== config.toType) {
    throw createValidationError(
      `Link "${input.kind}" must connect ${config.fromType} -> ${config.toType}.`
    )
  }

  if (config.roleField && typeof (input.metadata as Record<string, unknown>).role !== 'string') {
    throw createValidationError(`Link "${input.kind}" requires a metadata.role value.`)
  }
}

function buildListCondition(
  config: LinkConfig,
  query: LibraryLinkQuery | undefined
): SQL | undefined | null {
  if (!query) {
    return undefined
  }

  const conditions: SQL[] = []

  if (query.entity) {
    const entityConditions: SQL[] = []
    if (query.entity.entityType === config.fromType) {
      entityConditions.push(eq(getLinkColumn(config, config.fromIdField), query.entity.id))
    }
    if (query.entity.entityType === config.toType) {
      entityConditions.push(eq(getLinkColumn(config, config.toIdField), query.entity.id))
    }
    if (entityConditions.length === 0) {
      return null
    }
    conditions.push(
      entityConditions.length === 1 ? entityConditions[0]! : (or(...entityConditions) as SQL)
    )
  }

  if (query.relatedEntity) {
    const relatedConditions: SQL[] = []
    if (query.relatedEntity.entityType === config.fromType) {
      relatedConditions.push(eq(getLinkColumn(config, config.fromIdField), query.relatedEntity.id))
    }
    if (query.relatedEntity.entityType === config.toType) {
      relatedConditions.push(eq(getLinkColumn(config, config.toIdField), query.relatedEntity.id))
    }
    if (relatedConditions.length === 0) {
      return null
    }
    conditions.push(
      relatedConditions.length === 1 ? relatedConditions[0]! : (or(...relatedConditions) as SQL)
    )
  }

  return conditions.length > 0 ? (and(...conditions) as SQL) : undefined
}

function buildSelectorCondition<K extends LibraryLinkKind>(
  config: LinkConfig,
  selector: LibraryLinkSelector<K>
): SQL {
  if (selector.from.entityType !== config.fromType || selector.to.entityType !== config.toType) {
    throw createValidationError(
      `Link selector "${selector.kind}" must target ${config.fromType} -> ${config.toType}.`
    )
  }

  const conditions: SQL[] = [
    eq(getLinkColumn(config, config.fromIdField), selector.from.id),
    eq(getLinkColumn(config, config.toIdField), selector.to.id)
  ]

  if (config.roleField) {
    if (!('role' in selector) || typeof selector.role !== 'string') {
      throw createValidationError(`Link selector "${selector.kind}" requires a role value.`)
    }

    conditions.push(eq(getLinkColumn(config, config.roleField), selector.role))
  }

  return and(...conditions) as SQL
}

function buildInsertValues(
  config: LinkConfig,
  input: LibraryLinkCreateInput<LibraryLinkKind>
): SQLiteInsertValue<SQLiteTable> {
  const metadata = input.metadata as Record<string, unknown>
  const values: Record<string, unknown> = {
    [config.fromIdField]: input.from.id,
    [config.toIdField]: input.to.id
  }

  if (config.roleField) {
    values[config.roleField] = metadata.role
  }
  if (config.spoilerField) {
    values[config.spoilerField] = metadata.isSpoiler ?? false
  }
  if (config.noteField) {
    values[config.noteField] = metadata.note ?? null
  }
  if (config.orderField) {
    values[config.orderField] = metadata.order ?? 0
  }
  if (config.secondaryOrderField) {
    values[config.secondaryOrderField] = 0
  }

  return values as SQLiteInsertValue<SQLiteTable>
}

function buildUpdateValues(
  config: LinkConfig,
  patch: LibraryLinkPatch<LibraryLinkKind>
): SQLiteUpdateSetSource<SQLiteTable> {
  const input = patch as Record<string, unknown>
  const values: Record<string, unknown> = {}

  if (config.roleField && input.role !== undefined) {
    values[config.roleField] = input.role
  }
  if (config.spoilerField && input.isSpoiler !== undefined) {
    values[config.spoilerField] = input.isSpoiler
  }
  if (config.noteField && input.note !== undefined) {
    values[config.noteField] = input.note ?? null
  }
  if (config.orderField && input.order !== undefined) {
    values[config.orderField] = input.order
  }

  return values as SQLiteUpdateSetSource<SQLiteTable>
}

function getLinkColumn(config: LinkConfig, field: string): AnySQLiteColumn {
  const columns = config.table as unknown as Record<string, AnySQLiteColumn | undefined>
  const column = columns[field]
  if (!column) {
    throw createValidationError(`Link "${config.kind}" does not define column "${field}".`)
  }

  return column
}

function toLink(config: LinkConfig, row: Record<string, unknown>): LibraryLink {
  const metadata: Record<string, unknown> = {}

  if (config.roleField) {
    metadata.role = row[config.roleField]
  }
  if (config.spoilerField) {
    metadata.isSpoiler = Boolean(row[config.spoilerField])
  }
  if (config.noteField && typeof row[config.noteField] === 'string') {
    metadata.note = row[config.noteField]
  }
  if (config.orderField && typeof row[config.orderField] === 'number') {
    metadata.order = row[config.orderField]
  }

  return {
    kind: config.kind,
    from: {
      entityType: config.fromType as LibraryLink['from']['entityType'],
      id: String(row[config.fromIdField])
    },
    to: {
      entityType: config.toType as LibraryLink['to']['entityType'],
      id: String(row[config.toIdField])
    },
    metadata: metadata as LibraryLink['metadata'],
    createdAt: toTimestampMs(row.createdAt),
    updatedAt: toTimestampMs(row.updatedAt)
  }
}

function toTimestampMs(value: unknown): number | undefined {
  if (value instanceof Date) {
    return value.getTime()
  }

  return typeof value === 'number' ? value : undefined
}

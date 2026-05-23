import type {
  LibraryRelation,
  LibraryRelationCreateInput,
  LibraryRelationKind,
  LibraryRelationPatch,
  LibraryRelationQuery,
  LibraryRelationSelector
} from '@kisaki3/extension-api'
import {
  createNotFoundError,
  createValidationError,
  normalizeCapabilityError
} from '@kisaki3/extension-api'
import { and, eq, or, type SQL } from 'drizzle-orm'
import {
  characterPersonLinks,
  characterTagLinks,
  collectionCharacterLinks,
  collectionCompanyLinks,
  collectionGameLinks,
  collectionPersonLinks,
  companyTagLinks,
  gameCharacterLinks,
  gameCompanyLinks,
  gamePersonLinks,
  gameTagLinks,
  personTagLinks
} from '@shared/db'
import type { DbService } from '@main/services/db'
import type {
  AnySQLiteColumn,
  SQLiteInsertValue,
  SQLiteTable,
  SQLiteUpdateSetSource
} from 'drizzle-orm/sqlite-core'

interface RelationConfig {
  kind: LibraryRelationKind
  table: SQLiteTable
  fromType: string
  toType: string
  fromIdField: string
  toIdField: string
  orderField?: string
  secondaryOrderField?: string
  noteField?: string
  spoilerField?: string
  typeField?: string
}

const RELATION_CONFIGS: Record<LibraryRelationKind, RelationConfig> = {
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
    typeField: 'type'
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
    typeField: 'type'
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
    typeField: 'type'
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
    typeField: 'type'
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

export interface ExtensionLibraryRelationStoreOptions {
  db: DbService
}

export class ExtensionLibraryRelationStore {
  constructor(private readonly options: ExtensionLibraryRelationStoreOptions) {}

  list(query?: LibraryRelationQuery): readonly LibraryRelation[] {
    try {
      const kinds = query?.kinds?.length
        ? query.kinds
        : (Object.keys(RELATION_CONFIGS) as LibraryRelationKind[])
      const relations: LibraryRelation[] = []

      for (const kind of kinds) {
        const config = RELATION_CONFIGS[kind]
        const condition = buildListCondition(config, query)
        if (condition === null) {
          continue
        }

        const rows = condition
          ? this.options.db.client.select().from(config.table).where(condition).all()
          : this.options.db.client.select().from(config.table).all()

        for (const row of rows) {
          relations.push(toRelation(config, row))
        }
      }

      return relations
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to list library relations.')
    }
  }

  create<K extends LibraryRelationKind>(input: LibraryRelationCreateInput<K>): LibraryRelation<K> {
    const config = RELATION_CONFIGS[input.kind]
    validateRelationInput(config, input)

    try {
      this.options.db.client.insert(config.table).values(buildInsertValues(config, input)).run()
      const row = this.selectOne(
        config,
        input as unknown as LibraryRelationSelector<LibraryRelationKind>
      )
      return toRelation(config, row) as LibraryRelation<K>
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to create the library relation.')
    }
  }

  update<K extends LibraryRelationKind>(
    selector: LibraryRelationSelector<K>,
    patch: LibraryRelationPatch<K>
  ): LibraryRelation<K> {
    const config = RELATION_CONFIGS[selector.kind]

    try {
      const existing = this.selectOne(
        config,
        selector as unknown as LibraryRelationSelector<LibraryRelationKind>
      )
      void existing

      const values = buildUpdateValues(config, patch)
      if (Object.keys(values).length === 0) {
        return toRelation(config, existing) as LibraryRelation<K>
      }

      this.options.db.client
        .update(config.table)
        .set(values)
        .where(buildSelectorCondition(config, selector))
        .run()

      const updatedSelector =
        config.typeField && 'type' in patch && typeof patch.type === 'string'
          ? ({ ...selector, type: patch.type } as LibraryRelationSelector<K>)
          : selector
      const row = this.selectOne(
        config,
        updatedSelector as unknown as LibraryRelationSelector<LibraryRelationKind>
      )
      return toRelation(config, row) as LibraryRelation<K>
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to update the library relation.')
    }
  }

  remove<K extends LibraryRelationKind>(selector: LibraryRelationSelector<K>): void {
    const config = RELATION_CONFIGS[selector.kind]

    try {
      this.selectOne(config, selector as unknown as LibraryRelationSelector<LibraryRelationKind>)
      this.options.db.client
        .delete(config.table)
        .where(
          buildSelectorCondition(
            config,
            selector as unknown as LibraryRelationSelector<LibraryRelationKind>
          )
        )
        .run()
    } catch (error) {
      throw normalizeCapabilityError(error, 'Failed to remove the library relation.')
    }
  }

  private selectOne(
    config: RelationConfig,
    selector: LibraryRelationSelector<LibraryRelationKind>
  ): Record<string, unknown> {
    const row = this.options.db.client
      .select()
      .from(config.table)
      .where(buildSelectorCondition(config, selector))
      .get()

    if (!row) {
      throw createNotFoundError(`Library relation "${selector.kind}" was not found.`)
    }

    return row as Record<string, unknown>
  }
}

function validateRelationInput(
  config: RelationConfig,
  input: LibraryRelationCreateInput<LibraryRelationKind>
): void {
  if (input.from.entityType !== config.fromType || input.to.entityType !== config.toType) {
    throw createValidationError(
      `Relation "${input.kind}" must connect ${config.fromType} -> ${config.toType}.`
    )
  }

  if (config.typeField && typeof (input.metadata as Record<string, unknown>).type !== 'string') {
    throw createValidationError(`Relation "${input.kind}" requires a metadata.type value.`)
  }
}

function buildListCondition(
  config: RelationConfig,
  query: LibraryRelationQuery | undefined
): SQL | undefined | null {
  if (!query) {
    return undefined
  }

  const conditions: SQL[] = []

  if (query.entity) {
    const entityConditions: SQL[] = []
    if (query.entity.entityType === config.fromType) {
      entityConditions.push(eq(getRelationColumn(config, config.fromIdField), query.entity.id))
    }
    if (query.entity.entityType === config.toType) {
      entityConditions.push(eq(getRelationColumn(config, config.toIdField), query.entity.id))
    }
    if (entityConditions.length === 0) {
      return null
    }
    conditions.push(
      entityConditions.length === 1 ? entityConditions[0] : (or(...entityConditions) as SQL)
    )
  }

  if (query.relatedEntity) {
    const relatedConditions: SQL[] = []
    if (query.relatedEntity.entityType === config.fromType) {
      relatedConditions.push(
        eq(getRelationColumn(config, config.fromIdField), query.relatedEntity.id)
      )
    }
    if (query.relatedEntity.entityType === config.toType) {
      relatedConditions.push(
        eq(getRelationColumn(config, config.toIdField), query.relatedEntity.id)
      )
    }
    if (relatedConditions.length === 0) {
      return null
    }
    conditions.push(
      relatedConditions.length === 1 ? relatedConditions[0] : (or(...relatedConditions) as SQL)
    )
  }

  return conditions.length > 0 ? (and(...conditions) as SQL) : undefined
}

function buildSelectorCondition<K extends LibraryRelationKind>(
  config: RelationConfig,
  selector: LibraryRelationSelector<K>
): SQL {
  if (selector.from.entityType !== config.fromType || selector.to.entityType !== config.toType) {
    throw createValidationError(
      `Relation selector "${selector.kind}" must target ${config.fromType} -> ${config.toType}.`
    )
  }

  const conditions: SQL[] = [
    eq(getRelationColumn(config, config.fromIdField), selector.from.id),
    eq(getRelationColumn(config, config.toIdField), selector.to.id)
  ]

  if (config.typeField) {
    if (!('type' in selector) || typeof selector.type !== 'string') {
      throw createValidationError(`Relation selector "${selector.kind}" requires a type value.`)
    }

    conditions.push(eq(getRelationColumn(config, config.typeField), selector.type))
  }

  return and(...conditions) as SQL
}

function buildInsertValues(
  config: RelationConfig,
  input: LibraryRelationCreateInput<LibraryRelationKind>
): SQLiteInsertValue<SQLiteTable> {
  const metadata = input.metadata as Record<string, unknown>
  const values: Record<string, unknown> = {
    [config.fromIdField]: input.from.id,
    [config.toIdField]: input.to.id
  }

  if (config.typeField) {
    values[config.typeField] = metadata.type
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
  config: RelationConfig,
  patch: LibraryRelationPatch<LibraryRelationKind>
): SQLiteUpdateSetSource<SQLiteTable> {
  const input = patch as Record<string, unknown>
  const values: Record<string, unknown> = {}

  if (config.typeField && input.type !== undefined) {
    values[config.typeField] = input.type
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

function getRelationColumn(config: RelationConfig, field: string): AnySQLiteColumn {
  const columns = config.table as unknown as Record<string, AnySQLiteColumn | undefined>
  const column = columns[field]
  if (!column) {
    throw createValidationError(`Relation "${config.kind}" does not define column "${field}".`)
  }

  return column
}

function toRelation(config: RelationConfig, row: Record<string, unknown>): LibraryRelation {
  const metadata: Record<string, unknown> = {}

  if (config.typeField) {
    metadata.type = row[config.typeField]
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
      entityType: config.fromType as LibraryRelation['from']['entityType'],
      id: String(row[config.fromIdField])
    },
    to: {
      entityType: config.toType as LibraryRelation['to']['entityType'],
      id: String(row[config.toIdField])
    },
    metadata: metadata as LibraryRelation['metadata'],
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

import type { ExternalId } from '@kisaki3/extension-api'
import type { SQL } from 'drizzle-orm'
import type {
  AnySQLiteColumn,
  SQLiteInsertValue,
  SQLiteTable,
  SQLiteUpdateSetSource
} from 'drizzle-orm/sqlite-core'
import type { FilterState } from '@shared/filter/model'
import type { FilterQuerySpec } from '@shared/filter/spec'
import type { SearchQuerySpec } from '@shared/search/spec'

export type EntityExternalIds = readonly ExternalId[]

export interface EntityListQueryBase {
  ids?: readonly string[]
  search?: string
  limit?: number
  offset?: number
  sort?: {
    field: string
    direction?: 'asc' | 'desc'
  }
}

export interface EntityCreateInputBase {
  name: string
  externalIds?: EntityExternalIds
}

export type EntityPatchInputBase = object

export type LibraryEntityTable = SQLiteTable & {
  id: AnySQLiteColumn<{ data: string }>
  $inferSelect: { id: string }
}

export interface ExternalIdConfig<TTable extends SQLiteTable = SQLiteTable> {
  table: TTable
  entityIdColumn: AnySQLiteColumn<{ data: string }>
  sourceColumn: AnySQLiteColumn<{ data: string }>
  externalIdColumn: AnySQLiteColumn<{ data: string }>
  orderColumn: AnySQLiteColumn<{ data: number }>
  toEntityId(row: TTable['$inferSelect']): string
  toExternalId(row: TTable['$inferSelect']): ExternalId
  buildInsertValue(
    entityId: string,
    externalId: ExternalId,
    order: number
  ): SQLiteInsertValue<TTable>
}

export interface EntityConfig<
  TEntity,
  TCreate extends EntityCreateInputBase,
  TPatch extends EntityPatchInputBase,
  TQuery extends EntityListQueryBase,
  TTable extends LibraryEntityTable,
  TExternalIdTable extends SQLiteTable = SQLiteTable
> {
  table: TTable
  filterSpec: FilterQuerySpec
  searchSpec: SearchQuerySpec
  externalIds?: ExternalIdConfig<TExternalIdTable>
  toFilter(query: TQuery | undefined): FilterState
  toDto(row: TTable['$inferSelect'], externalIds: EntityExternalIds): TEntity
  buildCreateValues(id: string, input: TCreate): SQLiteInsertValue<TTable>
  buildPatchValues(patch: TPatch): SQLiteUpdateSetSource<TTable>
  buildExtraConditions(query: TQuery | undefined): SQL[]
}

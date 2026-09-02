import type { AllEntityType } from '@shared/entity-types'
import type { FilterQuerySpec, FilterSortKeyOf } from '@shared/filter'

export interface FilterUiOption {
  value: string
  label: string
}

/**
 * UI metadata for one filterable field.
 *
 * `kind` mirrors the query spec kind vocabulary; the query spec owns SQL
 * mapping and relation targets, the UI spec owns labels and editor hints.
 */
export type FilterUiFieldDef =
  | { key: string; label: string; kind: 'boolean' }
  | { key: string; label: string; kind: 'enum'; options: FilterUiOption[] }
  | {
      key: string
      label: string
      kind: 'number'
      min?: number
      max?: number
      step?: number
      /** Unit suffix rendered after the range inputs (e.g. seconds, cm). */
      unit?: string
      /** Stored-value multiplier: displayed value × scale = query value. */
      valueScale?: number
    }
  | { key: string; label: string; kind: 'date' }
  | { key: string; label: string; kind: 'relation' }

/**
 * The UI field defs a query field admits: same key, and the editor shape that
 * belongs to its kind. A key/kind mismatch with the query spec is a type error.
 */
type FilterUiFieldDefFor<TField> = TField extends {
  key: infer TKey extends string
  kind: infer TKind
}
  ? Extract<FilterUiFieldDef, { kind: TKind }> & { key: TKey }
  : never

export interface FilterUiSortOption<TKey extends string = string> {
  key: TKey
  label: string
  /**
   * The field is an order of its own (a manual arrangement); a direction on
   * it is meaningless, so sort controls pin it to ascending.
   */
  directionFixed?: boolean
}

/**
 * UI spec for one entity, keyed to its query spec.
 *
 * The default type parameter keeps entity-generic consumers (builders, dialogs)
 * working with any spec; per-entity specs bind their own query spec so the
 * compiler checks field keys, field kinds, and sort keys.
 */
export interface FilterUiSpec<TQuerySpec extends FilterQuerySpec = FilterQuerySpec> {
  entityType: AllEntityType
  fields: readonly FilterUiFieldDefFor<TQuerySpec['fields'][number]>[]
  sortOptions: readonly FilterUiSortOption<FilterSortKeyOf<TQuerySpec>>[]
}

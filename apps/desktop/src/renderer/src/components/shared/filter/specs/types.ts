import type { AllEntityType } from '@shared/common'

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
    }
  | { key: string; label: string; kind: 'date' }
  | { key: string; label: string; kind: 'relation' }

export interface FilterUiSortOption {
  key: string
  label: string
}

export interface FilterUiSpec {
  entityType: AllEntityType
  fields: readonly FilterUiFieldDef[]
  sortOptions: readonly FilterUiSortOption[]
}

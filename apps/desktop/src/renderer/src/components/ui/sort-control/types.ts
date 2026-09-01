/** One selectable sort field. */
export interface SortOption<TField extends string = string> {
  value: TField
  label: string
  /** The field is an order of its own; the direction cannot change. */
  directionFixed?: boolean
}

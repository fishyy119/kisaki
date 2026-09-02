/**
 * Entity sort model.
 *
 * One sort value for every entity list surface: a spec sort key plus a
 * direction, or the reserved membership key. Membership means "the order the
 * scope itself defines" (a tag's or collection's member order, a dynamic
 * collection's configured order); a scope without an order of its own falls
 * back to the spec default. Membership carries no direction: the scope order
 * is taken verbatim and the direction is ignored.
 */

/** Sort direction for list ordering. */
export type SortDirection = 'asc' | 'desc'

/** Reserved sort key; no filter query spec may declare a sort field with it. */
export const MEMBERSHIP_SORT_KEY = 'membership'

export interface EntitySort {
  key: string
  direction: SortDirection
}

export function createMembershipSort(): EntitySort {
  return { key: MEMBERSHIP_SORT_KEY, direction: 'asc' }
}

/** Trusted domain check: whether the sort asks for the scope's own order. */
export function isMembershipSort(sort: EntitySort): boolean {
  return sort.key === MEMBERSHIP_SORT_KEY
}

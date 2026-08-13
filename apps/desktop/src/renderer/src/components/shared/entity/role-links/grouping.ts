/**
 * Normalized role-link items and grouping shared by the role-links section
 * and tab. Callers map their per-media link rows (person/company/character
 * links) into `RoleLinkItem` so the components stay entity-generic.
 */

import type { Character, Company, Person } from '@shared/db'

/** Satellite entity kinds that appear in role-grouped link lists. */
export type RoleLinkEntityType = 'character' | 'person' | 'company'

export interface RoleLinkItem {
  /** Link row id (stable list key) */
  id: string
  role: string | null
  entity: Character | Person | Company | null
}

/** Groups items by role (missing role folds into 'other'), dropping dangling links. */
export function groupRoleLinks(items: RoleLinkItem[]): Record<string, RoleLinkItem[]> {
  return items.reduce(
    (acc, item) => {
      if (!item.entity) return acc
      const role = item.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(item)
      return acc
    },
    {} as Record<string, RoleLinkItem[]>
  )
}

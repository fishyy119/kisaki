/**
 * Normalized media credit blocks shared by the works section and tab.
 *
 * A satellite entity (person/character/company) is credited on each media kind
 * through that kind's own link table and role vocabulary, so callers map every
 * link list into one `WorksBlock` and the components stay media-generic. Roles
 * only ever render as a card badge, so links keep their stored order.
 */

import type { MediaType } from '@shared/common'
import type { Anime, Game, Movie, Tv } from '@shared/db'
import type { LinkViewKey } from '../links'

export type WorkMedia = Game | Anime | Tv | Movie

export interface WorkItem {
  /** Link row id (stable list key) */
  id: string
  role: string | null
  /** Secondary line for the card, such as the characters played in this entry */
  subtitle?: string
  entity: WorkMedia | null
}

export interface WorksBlock {
  mediaType: MediaType
  items: WorkItem[]
  /** Role vocabulary of this media kind, used for the card badges */
  roleLabels: Record<string, string>
  /** Links form view editing this media kind from the satellite side */
  linkView: LinkViewKey
}

/** One credited media row, with its role resolved to a badge label. */
export interface WorkEntry {
  /** Link ids are unique per table only, so the media kind joins the key */
  key: string
  mediaType: MediaType
  entity: WorkMedia
  roleLabel: string | undefined
  subtitle: string | undefined
}

export interface ResolvedWorksBlock {
  mediaType: MediaType
  entries: WorkEntry[]
}

/** Resolves blocks to renderable entries, dropping dangling links and blocks. */
export function resolveWorksBlocks(blocks: WorksBlock[]): ResolvedWorksBlock[] {
  return blocks.reduce<ResolvedWorksBlock[]>((acc, block) => {
    const entries = block.items.flatMap<WorkEntry>((item) =>
      item.entity
        ? [
            {
              key: `${block.mediaType}:${item.id}`,
              mediaType: block.mediaType,
              entity: item.entity,
              roleLabel: item.role ? block.roleLabels[item.role] : undefined,
              subtitle: item.subtitle
            }
          ]
        : []
    )
    if (entries.length > 0) acc.push({ mediaType: block.mediaType, entries })
    return acc
  }, [])
}

/** Flattens all blocks into one ordered list for the compact overview row. */
export function flattenWorks(blocks: WorksBlock[]): WorkEntry[] {
  return resolveWorksBlocks(blocks).flatMap((block) => block.entries)
}

/**
 * Mechanical helpers for turning graph link inputs into ordered link rows.
 *
 * Only the shared mechanics live here: duplicate collapsing, per-side sequence
 * allocation, and identity lookup. Which columns a link row carries stays with
 * the entity that owns the table; character-person links are satellite rows
 * fed by every root media graph, so their row builder is shared here too.
 */

import { unionPlaying, type NewCharacterPersonLink } from '@shared/db'
import type { IngestCharacterPersonLink } from '../graph'

export interface ResolvedRelationState {
  isSpoiler: boolean
  /** Only media-person link tables carry a cast pairing. */
  playing?: string[]
  note?: string
}

/** Per-side sequence allocator for the `orderIn*` columns of link rows. */
export class LinkOrderCounters {
  private readonly counters = new Map<string, number>()

  next(side: string, ownerId: string): number {
    const key = `${side}:${ownerId}`
    const order = this.counters.get(key) ?? 0
    this.counters.set(key, order + 1)
    return order
  }
}

/**
 * Deduplicates link inputs by `key`, merging duplicates so a relation is
 * spoiler-tagged when any occurrence is, keeps the first available note and
 * unions the characters played, then builds one row per surviving relation
 * with ordered sequence numbers.
 */
export function resolveOrderedLinks<TInput, TResolved extends ResolvedRelationState, TRow>(params: {
  links: TInput[]
  resolve: (input: TInput) => { key: string; value: TResolved }
  buildRow: (resolved: TResolved, index: number, counters: LinkOrderCounters) => TRow
}): TRow[] {
  const resolved = new Map<string, TResolved>()

  for (const input of params.links) {
    const { key, value } = params.resolve(input)
    const existing = resolved.get(key)
    if (!existing) {
      resolved.set(key, value)
      continue
    }

    existing.isSpoiler = existing.isSpoiler || value.isSpoiler
    existing.playing = unionPlaying(existing.playing, value.playing)
    existing.note = existing.note ?? value.note
  }

  const counters = new LinkOrderCounters()
  return [...resolved.values()].map((value, index) => params.buildRow(value, index, counters))
}

export function requirePersistedId(
  idByIdentity: Map<string, string>,
  identityKey: string,
  entity: string
): string {
  const id = idByIdentity.get(identityKey)
  if (!id) {
    throw new Error(`Missing persisted ${entity} for identity: ${identityKey}`)
  }
  return id
}

export function requireOwnerIdentity(
  linkOwnerIdentityKey: string,
  ownerIdentityKey: string,
  owner: string
): void {
  if (linkOwnerIdentityKey !== ownerIdentityKey) {
    throw new Error(`Link references unexpected ${owner} identity: ${linkOwnerIdentityKey}`)
  }
}

export function resolveCharacterPersonLinks(params: {
  links: IngestCharacterPersonLink[]
  characterIdByIdentity: Map<string, string>
  personIdByIdentity: Map<string, string>
}): NewCharacterPersonLink[] {
  const { links, characterIdByIdentity, personIdByIdentity } = params

  return resolveOrderedLinks({
    links,
    resolve: (link) => {
      const characterId = requirePersistedId(
        characterIdByIdentity,
        link.characterIdentityKey,
        'character'
      )
      const personId = requirePersistedId(personIdByIdentity, link.personIdentityKey, 'person')
      return {
        key: `${characterId}:${personId}:${link.role}`,
        value: {
          characterId,
          personId,
          role: link.role,
          isSpoiler: link.isSpoiler,
          note: link.note
        }
      }
    },
    buildRow: (link, _index, counters) => ({
      characterId: link.characterId,
      personId: link.personId,
      role: link.role,
      isSpoiler: link.isSpoiler,
      note: link.note ?? null,
      orderInCharacter: counters.next('character', link.characterId),
      orderInPerson: counters.next('person', link.personId)
    })
  })
}

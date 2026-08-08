/**
 * Mechanical helpers for turning graph link inputs into ordered link rows.
 *
 * Only the shared mechanics live here: duplicate collapsing, per-side sequence
 * allocation, and identity lookup. Which columns a link row carries stays with
 * the entity that owns the table.
 */

export interface ResolvedRelationState {
  isSpoiler: boolean
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
 * spoiler-tagged when any occurrence is and keeps the first available note,
 * then builds one row per surviving relation with ordered sequence numbers.
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

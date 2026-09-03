/**
 * Scroll memory: one remembered offset per identity.
 *
 * An identity names what a scroll viewport displays (a route path, a route
 * path with its list query, a fixed panel name, a horizontal row inside one
 * of those). The offset written under an identity is what the viewport
 * restores when it displays that identity again. Session-scoped: a restart
 * is a fresh session, and offsets never outlive the content they index.
 */

const CAPACITY = 256

const offsets = new Map<string, number>()

/** The offset remembered for the identity, if any. */
export function readScrollMemory(identity: string): number | undefined {
  const offset = offsets.get(identity)
  if (offset === undefined) return undefined
  // Re-insert so the map's iteration order stays least-recently-used first.
  offsets.delete(identity)
  offsets.set(identity, offset)
  return offset
}

/** Remember the identity's offset; the least recently used entry yields when full. */
export function writeScrollMemory(identity: string, offset: number): void {
  if (offsets.has(identity)) {
    offsets.delete(identity)
  } else if (offsets.size >= CAPACITY) {
    const oldest = offsets.keys().next().value
    if (oldest !== undefined) offsets.delete(oldest)
  }
  offsets.set(identity, offset)
}

/** Identity of a scroller nested in a region: the region's identity plus a local key. */
export function nestedScrollIdentity(parent: string, key: string): string {
  return `${parent}#${key}`
}

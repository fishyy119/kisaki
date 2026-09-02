/**
 * Identifier minting.
 *
 * Every identifier the application generates — row ids, attachment file names,
 * runtime handles, temp-file suffixes — comes from this one function, so the
 * whole system agrees on a single format. The format is RFC 9562 UUID: a
 * standard every runtime (main, renderer, extension host) mints natively and
 * every external tool recognizes, URL-safe for deeplinks and path-safe for the
 * attachment layout.
 *
 * Existing rows keep whatever id they were created with; an id is an opaque
 * string once minted, and nothing anywhere inspects its shape.
 */

export function newId(): string {
  return crypto.randomUUID()
}

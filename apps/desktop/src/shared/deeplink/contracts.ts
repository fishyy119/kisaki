/**
 * `kisaki://` deeplink wire contract — the authoritative specification.
 *
 * A deeplink is an untrusted, fire-and-forget command message handed to the
 * app by the operating system. Its URL is the most durable external artifact
 * of the whole system — it lives on in browsers, other apps' configs, relay
 * server registrations, and user notes — so everything specified here changes
 * only by deliberate decision.
 *
 * Address vs payload: the path addresses an intent, the query parameterizes
 * it. The query never participates in routing; duplicate query keys resolve
 * last-wins.
 *
 * Registered namespaces (first path segment). Each is a curated vocabulary
 * owned by its addressee — never a raw passthrough of internal structure:
 *
 * - `kisaki://open/<destination>` — show a named destination in the main
 *   window. The renderer owns the destination vocabulary and its resolution.
 * - `kisaki://launch/<mediaType>/<entityId>` — start consuming an entry.
 *   Owned by the activity service.
 * - `kisaki://ext/<extensionId>/<path>` — delegated to the deeplink routes
 *   the extension registered.
 *
 * `open` and `launch` share the entity-noun vocabulary and stay orthogonal:
 * `open` shows, `launch` acts, and neither ever implies the other.
 *
 * URL physics encoded by the parser:
 * - The first segment arrives as the URL hostname, which the WHATWG parser
 *   lowercases; namespaces are therefore lowercase-only.
 * - Every path segment is percent-decoded exactly once; decoded segments must
 *   not be empty, contain separators, or be `..`.
 */

import { normalizeDeeplinkRoutePath } from './pattern'

export const DEEPLINK_SCHEME = 'kisaki'

/** Query payload of a deeplink; values are attacker-controlled input. */
export type DeeplinkQuery = Record<string, string>

/** A parsed, normalized deeplink: the unit the router dispatches. */
export interface DeeplinkRequest {
  /** Normalized (decoded, validated) route path, e.g. `/open/anime/123`. */
  path: string
  query: DeeplinkQuery
}

/**
 * Total parser from an OS-provided URL string to a request. Returns null for
 * anything that is not a well-formed `kisaki://` URL; it never throws.
 */
export function parseDeeplinkUrl(url: string): DeeplinkRequest | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  if (parsed.protocol !== `${DEEPLINK_SCHEME}:`) {
    return null
  }

  const hostPath = parsed.hostname ? `/${parsed.hostname}` : ''
  const rawPath = `${hostPath}${parsed.pathname || ''}`
  if (!rawPath) {
    return null
  }

  let path: string
  try {
    path = normalizeDeeplinkRoutePath(rawPath)
  } catch {
    return null
  }

  const query: DeeplinkQuery = {}
  parsed.searchParams.forEach((value, key) => {
    query[key] = value
  })

  return { path, query }
}

/** Absolute deeplink URL of an extension route, e.g. for OAuth callbacks. */
export function buildExtensionDeeplinkUrl(extensionId: string, path: string): string {
  return `${DEEPLINK_SCHEME}://ext/${extensionId}${path}`
}

/** Main → renderer payload of the `open` namespace (`deeplink:open`). */
export interface DeeplinkOpenPayload {
  /** Destination path within the `open` vocabulary, e.g. `/anime/123`. */
  path: string
  query: DeeplinkQuery
}

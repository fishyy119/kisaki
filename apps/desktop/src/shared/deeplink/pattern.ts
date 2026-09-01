/**
 * Deeplink route pattern grammar — the single implementation shared by the
 * main router, the extension contribution points on both sides of the host
 * boundary, and the renderer destination table.
 *
 * A pattern is a `/`-joined sequence of exactly three segment kinds:
 * - literal:    matches itself
 * - `:name`     matches one segment, captured as a param
 * - `*name`     matches the rest of the path (final segment only)
 *
 * Matching is most-specific-wins: literals outrank params, params outrank
 * wildcards; ties break by registration order.
 */

const PARAM_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

type DeeplinkRouteSegment =
  | { kind: 'literal'; value: string }
  | { kind: 'param'; name: string }
  | { kind: 'wildcard'; name: string }

export interface CompiledDeeplinkRoutePattern {
  pattern: string
  segments: readonly DeeplinkRouteSegment[]
  /** Specificity: higher wins. Literal 100, param 10, wildcard -1000. */
  score: number
}

// =============================================================================
// Typed params derived from the pattern string
// =============================================================================

type TrimLeadingSlash<TValue extends string> = TValue extends `/${infer TRest}`
  ? TrimLeadingSlash<TRest>
  : TValue

type SegmentParamName<TSegment extends string> = TSegment extends `:${infer TName}`
  ? TName extends ''
    ? never
    : TName
  : TSegment extends `*${infer TName}`
    ? TName extends ''
      ? never
      : TName
    : never

type RouteParamNames<TPattern extends string> =
  TrimLeadingSlash<TPattern> extends ''
    ? never
    : TrimLeadingSlash<TPattern> extends `${infer THead}/${infer TTail}`
      ? SegmentParamName<THead> | RouteParamNames<TTail>
      : SegmentParamName<TrimLeadingSlash<TPattern>>

export type DeeplinkRouteParams<TPattern extends string> = string extends TPattern
  ? Record<string, string>
  : [RouteParamNames<TPattern>] extends [never]
    ? Record<never, never>
    : { [TName in RouteParamNames<TPattern>]: string }

// =============================================================================
// Compile and match
// =============================================================================

export function compileDeeplinkRoutePattern(pattern: string): CompiledDeeplinkRoutePattern {
  const normalized = normalizeDeeplinkRoutePattern(pattern)
  const segments = splitRoutePath(normalized).map((segment, index, all) =>
    compileSegment(segment, index, all.length)
  )

  return {
    pattern: normalized,
    segments,
    score: scoreSegments(segments)
  }
}

/** Validates pattern grammar; throws on malformed patterns. */
export function normalizeDeeplinkRoutePattern(pattern: string): string {
  return normalizeRoutePath(pattern, { allowParams: true })
}

/** Decodes and validates a concrete path; throws on malformed paths. */
export function normalizeDeeplinkRoutePath(path: string): string {
  return normalizeRoutePath(path, { allowParams: false })
}

/**
 * Matches a normalized path (every path produced by `parseDeeplinkUrl` is)
 * against a compiled pattern, returning captured params or null.
 */
export function matchDeeplinkRoutePattern(
  compiled: CompiledDeeplinkRoutePattern,
  path: string
): Record<string, string> | null {
  const pathSegments = splitRoutePath(path)
  const params: Record<string, string> = {}

  for (let routeIndex = 0, pathIndex = 0; routeIndex < compiled.segments.length; routeIndex++) {
    const routeSegment = compiled.segments[routeIndex]!
    const pathSegment = pathSegments[pathIndex]

    if (routeSegment.kind === 'wildcard') {
      params[routeSegment.name] = pathSegments.slice(pathIndex).join('/')
      return params
    }

    if (pathSegment === undefined) {
      return null
    }

    if (routeSegment.kind === 'literal' && routeSegment.value !== pathSegment) {
      return null
    }

    if (routeSegment.kind === 'param') {
      params[routeSegment.name] = pathSegment
    }

    pathIndex++

    if (routeIndex === compiled.segments.length - 1 && pathIndex < pathSegments.length) {
      return null
    }
  }

  return pathSegments.length === compiled.segments.length ? params : null
}

// =============================================================================
// Internals
// =============================================================================

function normalizeRoutePath(path: string, options: { allowParams: boolean }): string {
  const normalized = path.trim()

  if (!normalized.startsWith('/')) {
    throw new Error(`Deeplink route path "${path}" must start with "/".`)
  }

  if (normalized.includes('?') || normalized.includes('#') || /^[a-z][a-z0-9+.-]*:/i.test(path)) {
    throw new Error(`Deeplink route path "${path}" must not include query, hash, or a full URL.`)
  }

  if (
    normalized.includes('\\') ||
    normalized.split('/').some((segment) => segment === '..') ||
    (normalized.length > 1 &&
      normalized.split('/').some((segment, index) => index > 0 && segment === ''))
  ) {
    throw new Error(
      `Deeplink route path "${path}" must not include backslashes, empty segments, or "..".`
    )
  }

  if (!options.allowParams) {
    return decodeRoutePath(normalized)
  }

  const segments = splitRoutePath(normalized)
  segments.forEach((segment, index) => validatePatternSegment(segment, index, segments.length))
  return normalized
}

function decodeRoutePath(path: string): string {
  const decodedSegments = splitRoutePath(path).map((segment) => {
    try {
      const decoded = decodeURIComponent(segment)
      if (!decoded || decoded.includes('/') || decoded.includes('\\') || decoded === '..') {
        throw new Error()
      }
      return decoded
    } catch {
      throw new Error(`Deeplink route path "${path}" contains an invalid encoded segment.`)
    }
  })

  return decodedSegments.length === 0 ? '/' : `/${decodedSegments.join('/')}`
}

function splitRoutePath(path: string): string[] {
  return path === '/' ? [] : path.slice(1).split('/')
}

function compileSegment(
  segment: string,
  index: number,
  segmentCount: number
): DeeplinkRouteSegment {
  validatePatternSegment(segment, index, segmentCount)

  if (segment.startsWith(':')) {
    return { kind: 'param', name: segment.slice(1) }
  }

  if (segment.startsWith('*')) {
    return { kind: 'wildcard', name: segment.slice(1) }
  }

  return { kind: 'literal', value: segment }
}

function validatePatternSegment(segment: string, index: number, segmentCount: number): void {
  if (segment.startsWith(':')) {
    const name = segment.slice(1)
    if (!PARAM_NAME_PATTERN.test(name)) {
      throw new Error(`Deeplink route parameter segment "${segment}" has an invalid name.`)
    }
    return
  }

  if (segment.startsWith('*')) {
    const name = segment.slice(1)
    if (index !== segmentCount - 1) {
      throw new Error(`Deeplink route wildcard segment "${segment}" must be the final segment.`)
    }
    if (!PARAM_NAME_PATTERN.test(name)) {
      throw new Error(`Deeplink route wildcard segment "${segment}" has an invalid name.`)
    }
    return
  }

  if (segment.includes(':') || segment.includes('*')) {
    throw new Error(`Deeplink route literal segment "${segment}" must not contain ":" or "*".`)
  }
}

function scoreSegments(segments: readonly DeeplinkRouteSegment[]): number {
  return segments.reduce((score, segment) => {
    if (segment.kind === 'literal') {
      return score + 100
    }

    if (segment.kind === 'param') {
      return score + 10
    }

    return score - 1000
  }, segments.length)
}

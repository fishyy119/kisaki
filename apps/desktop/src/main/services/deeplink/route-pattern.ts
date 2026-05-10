import type { DeeplinkParamMap } from '@shared/deeplink'

const PARAM_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

type DeeplinkRouteSegment =
  | { kind: 'literal'; value: string }
  | { kind: 'param'; name: string }
  | { kind: 'wildcard'; name: string }

export interface CompiledDeeplinkRoutePattern {
  pattern: string
  segments: readonly DeeplinkRouteSegment[]
  score: number
}

export interface DeeplinkRouteMatch {
  path: string
  params: DeeplinkParamMap
}

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

export function normalizeDeeplinkRoutePattern(pattern: string): string {
  return normalizeRoutePath(pattern, { allowParams: true })
}

export function normalizeDeeplinkRoutePath(path: string): string {
  return normalizeRoutePath(path, { allowParams: false })
}

export function matchDeeplinkRoutePath(
  compiled: CompiledDeeplinkRoutePattern,
  path: string
): DeeplinkParamMap | null {
  return matchDeeplinkRoutePathInfo(compiled, path)?.params ?? null
}

export function matchDeeplinkRoutePathInfo(
  compiled: CompiledDeeplinkRoutePattern,
  path: string
): DeeplinkRouteMatch | null {
  const normalizedPath = normalizeDeeplinkRoutePath(path)
  const params = matchNormalizedDeeplinkRoutePath(compiled, normalizedPath)
  return params ? { path: normalizedPath, params } : null
}

export function matchNormalizedDeeplinkRoutePath(
  compiled: CompiledDeeplinkRoutePattern,
  normalizedPath: string
): DeeplinkParamMap | null {
  const pathSegments = splitRoutePath(normalizedPath)
  const params: DeeplinkParamMap = {}

  for (let routeIndex = 0, pathIndex = 0; routeIndex < compiled.segments.length; routeIndex++) {
    const routeSegment = compiled.segments[routeIndex]
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

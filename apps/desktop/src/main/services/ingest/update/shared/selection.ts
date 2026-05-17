import type { UpdateResolvedSelection } from '../types'

export function normalizeSelection<T extends string>(
  selection: readonly T[] | null | undefined,
  allowed: readonly T[]
): T[] {
  const allowedSet = new Set(allowed)
  return [...new Set((selection ?? []).filter((item): item is T => allowedSet.has(item as T)))]
}

export function resolveUpdateSelection<
  TSurface extends string,
  TCoreSurface extends TSurface,
  TMediaSurface extends TSurface,
  TRelationSurface extends TSurface = never
>(params: {
  surfaces: readonly TSurface[]
  coreSurfaces: readonly TCoreSurface[]
  mediaSurfaces: readonly TMediaSurface[]
  relationSurfaces?: readonly TRelationSurface[]
}): UpdateResolvedSelection<TSurface, TCoreSurface, TMediaSurface, TRelationSurface> {
  const selected = new Set(params.surfaces)

  return {
    surfaces: [...params.surfaces],
    coreSurfaces: params.coreSurfaces.filter((surface) => selected.has(surface as TSurface)),
    mediaSurfaces: params.mediaSurfaces.filter((surface) => selected.has(surface as TSurface)),
    relationSurfaces: (params.relationSurfaces ?? []).filter((surface) =>
      selected.has(surface as TSurface)
    ) as TRelationSurface[]
  }
}

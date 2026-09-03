import { computed, type WritableComputedRef } from 'vue'

/** One writable ref per param; a set replaces the params wholesale. */
export type ParamRefs<TParams extends object> = {
  readonly [K in keyof TParams]: WritableComputedRef<TParams[K]>
}

/**
 * Per-key writable refs over one params holder. Params are replaced
 * wholesale through `commit`, never mutated, so a shallow holder sees every
 * change. Refs are created on first access, so no key enumeration is needed.
 */
export function projectParams<TParams extends object>(
  read: () => TParams | null,
  commit: (next: TParams) => void
): ParamRefs<TParams> {
  const refs = new Map<PropertyKey, WritableComputedRef<unknown>>()

  return new Proxy({} as ParamRefs<TParams>, {
    get(_target, property) {
      let projected = refs.get(property)
      if (!projected) {
        projected = computed({
          get: () => (read() as Record<PropertyKey, unknown> | null)?.[property],
          set: (value) => {
            const current = read()
            if (!current) return
            commit({ ...current, [property]: value })
          }
        })
        refs.set(property, projected)
      }
      return projected
    }
  })
}

/**
 * Media scope selection shared by the sync and import surfaces.
 *
 * The overview only lists scopes with a local adapter, so the selection always
 * has to follow the registered set instead of a hard-coded default.
 */

import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import type { BangumiMediaScope } from '../../shared/scopes'
import type { BangumiOptionItem, BangumiScopeOption } from '../../shared/settings'

export interface ScopeSelection {
  scope: Ref<BangumiMediaScope | undefined>
  options: ComputedRef<readonly BangumiScopeOption[]>
  profiles: ComputedRef<readonly BangumiOptionItem[]>
}

export function useScopeSelection(readScopes: () => readonly BangumiScopeOption[]): ScopeSelection {
  const options = computed(readScopes)
  const scope = ref<BangumiMediaScope | undefined>(options.value[0]?.scope)

  watch(options, (next) => {
    if (!next.some((option) => option.scope === scope.value)) {
      scope.value = next[0]?.scope
    }
  })

  const profiles = computed(
    () => options.value.find((option) => option.scope === scope.value)?.profiles ?? []
  )

  return { scope, options, profiles }
}

/**
 * Company media credit blocks.
 *
 * Each media kind credits companies through its own link table and role
 * vocabulary, so every list is mapped into one `WorksBlock` and the shared
 * works surfaces stay media-generic.
 */

import { computed, type ComputedRef } from 'vue'
import type { WorksBlock } from '@renderer/components/shared/entity'
import { useCompany } from '@renderer/composables/use-company'
import { useI18n } from '@renderer/composables/use-i18n'

export function useCompanyWorksBlocks(): ComputedRef<WorksBlock[]> {
  const { games, animes, tvs, movies } = useCompany()
  const { m } = useI18n()

  return computed<WorksBlock[]>(() => [
    {
      mediaType: 'game',
      items: games.value.map((link) => ({ id: link.id, role: link.role, entity: link.game })),
      roleLabels: m.value.library.roles.gameCompany,
      linkView: 'company-games'
    },
    {
      mediaType: 'anime',
      items: animes.value.map((link) => ({ id: link.id, role: link.role, entity: link.anime })),
      roleLabels: m.value.library.roles.animeCompany,
      linkView: 'company-animes'
    },
    {
      mediaType: 'tv',
      items: tvs.value.map((link) => ({ id: link.id, role: link.role, entity: link.tv })),
      roleLabels: m.value.library.roles.tvCompany,
      linkView: 'company-tvs'
    },
    {
      mediaType: 'movie',
      items: movies.value.map((link) => ({ id: link.id, role: link.role, entity: link.movie })),
      roleLabels: m.value.library.roles.movieCompany,
      linkView: 'company-movies'
    }
  ])
}

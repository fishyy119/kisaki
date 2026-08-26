/**
 * Company media credit blocks.
 *
 * Each media kind credits companies through its own link table and role
 * vocabulary, so every list is mapped into one `WorksBlock` and the shared
 * works surfaces stay media-generic. The specs are keyed by the media-type
 * union, so a new media type must declare its block here to compile.
 */

import { computed, type ComputedRef } from 'vue'
import {
  buildWorksBlocks,
  type WorksBlock,
  type WorksBlockSpec
} from '@renderer/components/shared/entity'
import { useCompany } from '@renderer/composables/use-company'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaType } from '@shared/common'

export function useCompanyWorksBlocks(): ComputedRef<WorksBlock[]> {
  const { games, animes, comics, novels } = useCompany()
  const { m } = useI18n()

  return computed<WorksBlock[]>(() => {
    const specs: Record<MediaType, WorksBlockSpec> = {
      game: {
        items: games.value.map((link) => ({ id: link.id, role: link.role, entity: link.game })),
        roleLabels: m.value.library.roles.gameCompany,
        linkView: 'company-games'
      },
      anime: {
        items: animes.value.map((link) => ({ id: link.id, role: link.role, entity: link.anime })),
        roleLabels: m.value.library.roles.animeCompany,
        linkView: 'company-animes'
      },
      comic: {
        items: comics.value.map((link) => ({ id: link.id, role: link.role, entity: link.comic })),
        roleLabels: m.value.library.roles.comicCompany,
        linkView: 'company-comics'
      },
      novel: {
        items: novels.value.map((link) => ({ id: link.id, role: link.role, entity: link.novel })),
        roleLabels: m.value.library.roles.novelCompany,
        linkView: 'company-novels'
      }
    }

    return buildWorksBlocks(specs)
  })
}

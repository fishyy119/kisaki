/**
 * Person media credit blocks.
 *
 * Each media kind credits people through its own link table and role
 * vocabulary, so every list is mapped into one `WorksBlock` and the shared
 * works surfaces stay media-generic. Works list the entries, not the parts:
 * the characters a credit performs belong to the entry's own credit list. The
 * specs are keyed by the media-type union, so a new media type must declare its
 * block here to compile.
 */

import { computed, type ComputedRef } from 'vue'
import {
  buildWorksBlocks,
  type WorksBlock,
  type WorksBlockSpec
} from '@renderer/components/shared/entity'
import { usePerson } from '@renderer/composables/use-person'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaType } from '@shared/entity-types'

export function usePersonWorksBlocks(): ComputedRef<WorksBlock[]> {
  const { games, animes, comics, novels } = usePerson()
  const { m } = useI18n()

  return computed<WorksBlock[]>(() => {
    const specs: Record<MediaType, WorksBlockSpec> = {
      game: {
        items: games.value.map((link) => ({ id: link.id, role: link.role, entity: link.game })),
        roleLabels: m.value.library.roles.gamePerson,
        linkView: 'person-games'
      },
      anime: {
        items: animes.value.map((link) => ({ id: link.id, role: link.role, entity: link.anime })),
        roleLabels: m.value.library.roles.animePerson,
        linkView: 'person-animes'
      },
      comic: {
        items: comics.value.map((link) => ({ id: link.id, role: link.role, entity: link.comic })),
        roleLabels: m.value.library.roles.comicPerson,
        linkView: 'person-comics'
      },
      novel: {
        items: novels.value.map((link) => ({ id: link.id, role: link.role, entity: link.novel })),
        roleLabels: m.value.library.roles.novelPerson,
        linkView: 'person-novels'
      }
    }

    return buildWorksBlocks(specs)
  })
}

/**
 * Character media appearance blocks.
 *
 * Each media kind links characters through its own link table and role
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
import { useCharacter } from '@renderer/composables/use-character'
import { useI18n } from '@renderer/composables/use-i18n'
import type { MediaType } from '@shared/common'

export function useCharacterWorksBlocks(): ComputedRef<WorksBlock[]> {
  const { games, animes, comics, novels } = useCharacter()
  const { m } = useI18n()

  return computed<WorksBlock[]>(() => {
    const specs: Record<MediaType, WorksBlockSpec> = {
      game: {
        items: games.value.map((link) => ({ id: link.id, role: link.role, entity: link.game })),
        roleLabels: m.value.library.roles.gameCharacter,
        linkView: 'character-games'
      },
      anime: {
        items: animes.value.map((link) => ({ id: link.id, role: link.role, entity: link.anime })),
        roleLabels: m.value.library.roles.animeCharacter,
        linkView: 'character-animes'
      },
      comic: {
        items: comics.value.map((link) => ({ id: link.id, role: link.role, entity: link.comic })),
        roleLabels: m.value.library.roles.comicCharacter,
        linkView: 'character-comics'
      },
      novel: {
        items: novels.value.map((link) => ({ id: link.id, role: link.role, entity: link.novel })),
        roleLabels: m.value.library.roles.novelCharacter,
        linkView: 'character-novels'
      }
    }

    return buildWorksBlocks(specs)
  })
}

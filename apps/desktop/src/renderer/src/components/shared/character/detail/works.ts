/**
 * Character media appearance blocks.
 *
 * Each media kind links characters through its own link table and role
 * vocabulary, so every list is mapped into one `WorksBlock` and the shared
 * works surfaces stay media-generic.
 */

import { computed, type ComputedRef } from 'vue'
import type { WorksBlock } from '@renderer/components/shared/entity'
import { useCharacter } from '@renderer/composables/use-character'
import { useI18n } from '@renderer/composables/use-i18n'

export function useCharacterWorksBlocks(): ComputedRef<WorksBlock[]> {
  const { games, animes } = useCharacter()
  const { m } = useI18n()

  return computed<WorksBlock[]>(() => [
    {
      mediaType: 'game',
      items: games.value.map((link) => ({ id: link.id, role: link.role, entity: link.game })),
      roleLabels: m.value.library.roles.gameCharacter,
      linkView: 'character-games'
    },
    {
      mediaType: 'anime',
      items: animes.value.map((link) => ({ id: link.id, role: link.role, entity: link.anime })),
      roleLabels: m.value.library.roles.animeCharacter,
      linkView: 'character-animes'
    }
  ])
}

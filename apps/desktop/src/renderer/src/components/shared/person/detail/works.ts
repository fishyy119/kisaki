/**
 * Person media credit blocks.
 *
 * Each media kind credits people through its own link table and role
 * vocabulary, so every list is mapped into one `WorksBlock` and the shared
 * works surfaces stay media-generic. Works list the entries, not the parts:
 * the characters a credit performs belong to the entry's own credit list.
 */

import { computed, type ComputedRef } from 'vue'
import type { WorksBlock } from '@renderer/components/shared/entity'
import { usePerson } from '@renderer/composables/use-person'
import { useI18n } from '@renderer/composables/use-i18n'

export function usePersonWorksBlocks(): ComputedRef<WorksBlock[]> {
  const { games, animes } = usePerson()
  const { m } = useI18n()

  return computed<WorksBlock[]>(() => [
    {
      mediaType: 'game',
      items: games.value.map((link) => ({
        id: link.id,
        role: link.role,
        entity: link.game
      })),
      roleLabels: m.value.library.roles.gamePerson,
      linkView: 'person-games'
    },
    {
      mediaType: 'anime',
      items: animes.value.map((link) => ({
        id: link.id,
        role: link.role,
        entity: link.anime
      })),
      roleLabels: m.value.library.roles.animePerson,
      linkView: 'person-animes'
    }
  ])
}

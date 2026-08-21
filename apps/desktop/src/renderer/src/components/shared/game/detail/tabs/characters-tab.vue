<!--
  Game Characters Tab

  Game character links in the shared role-links tab, each card labelled with the
  voice actors this entry credits for that character.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  EntityCastFormDialog,
  EntityRoleLinksTab,
  type RoleLinkItem
} from '@renderer/components/shared/entity'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { useGame } from '@renderer/composables/use-game'
import { useI18n } from '@renderer/composables/use-i18n'
import { GAME_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { game, characters, cast } = useGame()

const castDialogOpen = ref(false)

/** Voice actors this entry credits per character, in cast row order. */
const actorsByCharacter = computed(() => {
  const byCharacter = new Map<string, string[]>()
  for (const credit of cast.value) {
    if (!credit.person) continue
    const names = byCharacter.get(credit.characterId) ?? []
    names.push(credit.person.name)
    byCharacter.set(credit.characterId, names)
  }
  return byCharacter
})

const items = computed<RoleLinkItem[]>(() =>
  characters.value.map((link) => ({
    id: link.id,
    role: link.role,
    subtitle: actorsByCharacter.value.get(link.characterId)?.join(' / '),
    entity: link.character
  }))
)
</script>

<template>
  <EntityRoleLinksTab
    v-if="game"
    entity-type="character"
    :entity-id="game.id"
    :items="items"
    :role-order="GAME_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.gameCharacter"
    link-view="game-characters"
  >
    <template #actions>
      <Button
        variant="outline"
        size="sm"
        @click="castDialogOpen = true"
      >
        <Icon
          icon="icon-[mdi--microphone-outline]"
          class="size-4 mr-1.5"
        />
        {{ m.library.forms.editGameCast }}
      </Button>
    </template>
  </EntityRoleLinksTab>

  <EntityCastFormDialog
    v-if="game && castDialogOpen"
    v-model:open="castDialogOpen"
    media-type="game"
    :entity-id="game.id"
  />
</template>

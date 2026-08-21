<!--
  Anime Characters Tab

  Anime character links in the shared role-links tab, each card labelled with
  the voice actors this entry credits for that character.
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
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { ANIME_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()
const { anime, characters, cast } = useAnime()

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
    v-if="anime"
    entity-type="character"
    :entity-id="anime.id"
    :items="items"
    :role-order="ANIME_CHARACTER_ROLE_VALUES"
    :role-labels="m.library.roles.animeCharacter"
    link-view="anime-characters"
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
        {{ m.library.forms.editAnimeCast }}
      </Button>
    </template>
  </EntityRoleLinksTab>

  <EntityCastFormDialog
    v-if="anime && castDialogOpen"
    v-model:open="castDialogOpen"
    media-type="anime"
    :entity-id="anime.id"
  />
</template>

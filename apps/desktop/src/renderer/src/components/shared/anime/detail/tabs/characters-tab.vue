<!--
  Anime Characters Tab

  Characters tab content showing anime characters grouped by role.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'
import { EntityLinksFormDialog } from '@renderer/components/shared/entity'
import { ANIME_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()

const { anime, characters } = useAnime()

const editDialogOpen = ref(false)
const openCharacterId = ref<string | null>(null)

const CHARACTER_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCharacter
)

const groupedCharacters = computed(() =>
  characters.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof characters.value>
  )
)

const characterDialogOpen = computed({
  get: () => openCharacterId.value !== null,
  set: (value) => {
    if (!value) openCharacterId.value = null
  }
})
</script>

<template>
  <template v-if="anime">
    <StateView
      v-if="characters.length === 0"
      state="empty"
      :icon="getEntityIcon('character')"
      :description="m.library.detail.empty.characters"
      class="py-12"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="editDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.addEntity({ label: m.library.entities.character }) }}
        </Button>
      </template>
    </StateView>

    <template v-else>
      <!-- Header with manage button -->
      <div class="flex items-center justify-start mb-4">
        <Button
          variant="outline"
          size="sm"
          @click="editDialogOpen = true"
        >
          <Icon
            icon="icon-[mdi--pencil-outline]"
            class="size-4 mr-1.5"
          />
          {{ m.library.detail.manage }}
        </Button>
      </div>

      <div class="space-y-4">
        <template
          v-for="type in ANIME_CHARACTER_ROLE_VALUES"
          :key="type"
        >
          <div v-if="groupedCharacters[type]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ CHARACTER_TYPE_LABELS[type] || type }}
            </h4>
            <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
              <template
                v-for="link in groupedCharacters[type]"
                :key="link.id"
              >
                <CharacterCard
                  v-if="link.character"
                  :character="link.character"
                  align="left"
                  size="sm"
                  @click="openCharacterId = link.character.id"
                />
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Dialog -->
    <EntityLinksFormDialog
      v-if="editDialogOpen"
      v-model:open="editDialogOpen"
      view="anime-characters"
      :entity-id="anime.id"
    />

    <CharacterDetailDialog
      v-if="openCharacterId"
      v-model:open="characterDialogOpen"
      :character-id="openCharacterId"
    />
  </template>
</template>

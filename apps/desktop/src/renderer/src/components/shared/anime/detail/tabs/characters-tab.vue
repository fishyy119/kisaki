<!--
  Anime Characters Tab

  Characters tab content showing anime characters grouped by role.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getEntityIcon } from '@renderer/utils/format'

const CHARACTER_TYPE_ORDER = ['main', 'supporting', 'cameo', 'other'] as const

const { m } = useI18n()

const { anime, characters } = useAnime()

const openCharacterId = ref<string | null>(null)

const CHARACTER_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animeCharacter
)

const groupedCharacters = computed(() =>
  characters.value.reduce(
    (acc, link) => {
      const type = link.type || 'other'
      if (!acc[type]) acc[type] = []
      acc[type].push(link)
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
    />

    <div
      v-else
      class="space-y-4"
    >
      <template
        v-for="type in CHARACTER_TYPE_ORDER"
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

    <CharacterDetailDialog
      v-if="openCharacterId"
      v-model:open="characterDialogOpen"
      :character-id="openCharacterId"
    />
  </template>
</template>

<!--
  Game Characters Tab

  Characters tab content showing game characters grouped by role.
-->

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useGame } from '@renderer/composables/use-game'
import { getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { CharacterCard, CharacterDetailDialog } from '@renderer/components/shared/character'
import { GameCharactersFormDialog } from '../../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const CHARACTER_TYPE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCharacter
)

const CHARACTER_TYPE_ORDER = ['main', 'supporting', 'other'] as const

// =============================================================================
// State
// =============================================================================

const { game, characters } = useGame()

const editDialogOpen = ref(false)
const openCharacterId = ref<string | null>(null)

// =============================================================================
// Computed
// =============================================================================

const hasCharacters = computed(() => characters.value && characters.value.length > 0)

/** Group characters by type */
const groupedCharacters = computed(() => {
  if (!hasCharacters.value) return {}
  return characters.value.reduce(
    (acc, link) => {
      const type = link.type || 'other'
      if (!acc[type]) acc[type] = []
      acc[type].push(link)
      return acc
    },
    {} as Record<string, typeof characters.value>
  )
})

const characterDialogOpen = computed({
  get: () => openCharacterId.value !== null,
  set: (value) => {
    if (!value) openCharacterId.value = null
  }
})
</script>

<template>
  <template v-if="game">
    <!-- Empty state -->
    <StateView
      v-if="!hasCharacters"
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

    <!-- Characters list -->
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
    </template>

    <!-- Edit Dialog -->
    <GameCharactersFormDialog
      v-if="editDialogOpen"
      v-model:open="editDialogOpen"
      :game-id="game.id"
    />

    <!-- Character Detail Dialog -->
    <CharacterDetailDialog
      v-if="openCharacterId"
      v-model:open="characterDialogOpen"
      :character-id="openCharacterId"
    />
  </template>
</template>

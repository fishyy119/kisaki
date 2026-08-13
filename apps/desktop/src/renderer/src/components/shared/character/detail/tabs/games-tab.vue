<!--
  CharacterGamesTab
  Games tab content for character detail dialog.
  Shows full grid of related games grouped by character role.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useCharacter } from '@renderer/composables/use-character'
import { getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { useI18n } from '@renderer/composables'
import { EntityLinksFormDialog } from '@renderer/components/shared/entity'
import { GAME_CHARACTER_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const { character, games } = useCharacter()

const editDialogOpen = ref(false)
const openGameId = ref<string | null>(null)

// =============================================================================
// Constants
// =============================================================================

const CHARACTER_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCharacter
)

// =============================================================================
// Computed
// =============================================================================

const hasGames = computed(() => games.value.length > 0)

const groupedGames = computed(() => {
  return games.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof games.value>
  )
})

// =============================================================================
// Handlers
// =============================================================================

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})
</script>

<template>
  <template v-if="character">
    <!-- Empty state -->
    <StateView
      v-if="!hasGames"
      state="empty"
      :icon="getEntityIcon('game')"
      :description="m.library.detail.empty.relatedGames"
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
          {{ m.library.detail.addEntity({ label: m.library.entities.game }) }}
        </Button>
      </template>
    </StateView>

    <!-- Content state -->
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
          v-for="role in GAME_CHARACTER_ROLE_VALUES"
          :key="role"
        >
          <div v-if="groupedGames[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ CHARACTER_ROLE_LABELS[role] || role }}
            </h4>
            <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
              <template
                v-for="link in groupedGames[role]"
                :key="link.id"
              >
                <GameCard
                  v-if="link.game"
                  :game="link.game"
                  size="sm"
                  align="left"
                  @click="openGameId = link.game!.id"
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
      view="character-games"
      :entity-id="character.id"
    />

    <!-- Game Detail Dialog -->
    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
  </template>
</template>

<!--
  CompanyDetailGamesTab
  Games tab content for company detail dialog.
  Shows full list of games by company role.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { useCompany } from '@renderer/composables'
import { getEntityIcon } from '@renderer/utils/format'
import { CompanyGamesFormDialog } from '../../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const GAME_COMPANY_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gameCompany
)

const GAME_COMPANY_ROLE_ORDER = ['developer', 'publisher', 'distributor', 'other'] as const

const { company, games } = useCompany()

const openGameId = ref<string | null>(null)
const editDialogOpen = ref(false)

const hasGames = computed(() => games.value.length > 0)

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})

// Group games by company type
const groupedGames = computed(() => {
  const groups: Record<string, typeof games.value> = {}
  for (const link of games.value) {
    const role = link.role || 'other'
    if (!groups[role]) groups[role] = []
    groups[role].push(link)
  }
  return groups
})
</script>

<template>
  <template v-if="company">
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

    <!-- Games list -->
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
          v-for="role in GAME_COMPANY_ROLE_ORDER"
          :key="role"
        >
          <div v-if="groupedGames[role] && groupedGames[role].length > 0">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ GAME_COMPANY_ROLE_LABELS[role] || role }}
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
    <CompanyGamesFormDialog
      v-if="editDialogOpen"
      v-model:open="editDialogOpen"
      :company-id="company.id"
    />

    <!-- Game Detail Dialog -->
    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
  </template>
</template>

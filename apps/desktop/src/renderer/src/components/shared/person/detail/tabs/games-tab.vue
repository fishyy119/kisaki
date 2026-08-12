<!--
  PersonGamesTab
  Full grid of related games grouped by person role.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { usePerson } from '@renderer/composables/use-person'
import { getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { GameCard, GameDetailDialog } from '@renderer/components/shared/game'
import { PersonGamesFormDialog } from '../../forms'
import { useI18n } from '@renderer/composables'

const { m } = useI18n()

const GAME_PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.gamePerson
)

const GAME_PERSON_ROLE_ORDER = [
  'director',
  'scenario',
  'illustration',
  'music',
  'programmer',
  'actor',
  'other'
] as const

const { person, games } = usePerson()

const editDialogOpen = ref(false)
const openGameId = ref<string | null>(null)

const hasGames = computed(() => games.value && games.value.length > 0)

const groupedGames = computed(() => {
  if (!hasGames.value) return {}
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

const gameDialogOpen = computed({
  get: () => openGameId.value !== null,
  set: (value) => {
    if (!value) openGameId.value = null
  }
})
</script>

<template>
  <template v-if="person">
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
          v-for="role in GAME_PERSON_ROLE_ORDER"
          :key="role"
        >
          <div v-if="groupedGames[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ GAME_PERSON_ROLE_LABELS[role] || role }}
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
                  @click="openGameId = link.game.id"
                />
              </template>
            </div>
          </div>
        </template>
      </div>
    </template>

    <!-- Edit Dialog -->
    <PersonGamesFormDialog
      v-if="editDialogOpen"
      v-model:open="editDialogOpen"
      :person-id="person.id"
    />

    <!-- Game Detail Dialog -->
    <GameDetailDialog
      v-if="openGameId"
      v-model:open="gameDialogOpen"
      :game-id="openGameId"
    />
  </template>
</template>

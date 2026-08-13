<!--
  PersonAnimesTab
  Full grid of related animes grouped by staff role.
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { usePerson } from '@renderer/composables/use-person'
import { getEntityIcon } from '@renderer/utils/format'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { AnimeCard, AnimeDetailDialog } from '@renderer/components/shared/anime'
import { useI18n } from '@renderer/composables'
import { EntityLinksFormDialog } from '@renderer/components/shared/entity'
import { ANIME_PERSON_ROLE_VALUES } from '@shared/db'

const { m } = useI18n()

const ANIME_PERSON_ROLE_LABELS = computed<Record<string, string>>(
  () => m.value.library.roles.animePerson
)

const { person, animes } = usePerson()

const editDialogOpen = ref(false)
const openAnimeId = ref<string | null>(null)

const hasAnimes = computed(() => animes.value && animes.value.length > 0)

const groupedAnimes = computed(() => {
  if (!hasAnimes.value) return {}
  return animes.value.reduce(
    (acc, link) => {
      const role = link.role || 'other'
      if (!acc[role]) acc[role] = []
      acc[role].push(link)
      return acc
    },
    {} as Record<string, typeof animes.value>
  )
})

const animeDialogOpen = computed({
  get: () => openAnimeId.value !== null,
  set: (value) => {
    if (!value) openAnimeId.value = null
  }
})
</script>

<template>
  <template v-if="person">
    <!-- Empty state -->
    <StateView
      v-if="!hasAnimes"
      state="empty"
      :icon="getEntityIcon('anime')"
      :description="m.library.detail.empty.relatedAnimes"
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
          {{ m.library.detail.addEntity({ label: m.library.entities.anime }) }}
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
          v-for="role in ANIME_PERSON_ROLE_VALUES"
          :key="role"
        >
          <div v-if="groupedAnimes[role]?.length">
            <h4 class="text-xs font-medium text-muted-foreground mb-2">
              {{ ANIME_PERSON_ROLE_LABELS[role] || role }}
            </h4>
            <div class="grid grid-cols-[repeat(auto-fill,6rem)] gap-3 justify-between">
              <template
                v-for="link in groupedAnimes[role]"
                :key="link.id"
              >
                <AnimeCard
                  v-if="link.anime"
                  :anime="link.anime"
                  size="sm"
                  align="left"
                  @click="openAnimeId = link.anime!.id"
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
      view="person-animes"
      :entity-id="person.id"
    />

    <!-- Anime Detail Dialog -->
    <AnimeDetailDialog
      v-if="openAnimeId"
      v-model:open="animeDialogOpen"
      :anime-id="openAnimeId"
    />
  </template>
</template>

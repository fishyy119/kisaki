<!--
  Tv Episodes Tab

  Season-grouped episode list with watch state, playback actions, and the file
  toolbar (files configuration, sync, manual season and episode creation),
  followed by the extras that belong to the entry but carry no watch state.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { Section } from '@renderer/components/ui/section'
import { StateView } from '@renderer/components/ui/state-view'
import { useI18n } from '@renderer/composables/use-i18n'
import { useTv } from '@renderer/composables/use-tv'
import { useTvFileSync } from '@renderer/composables/use-tv-file-sync'
import { revealTvFile } from '@renderer/composables/use-tv-file-records'
import { notify } from '@renderer/core/notify'
import { cn } from '@renderer/utils/cn'
import { TV_EXTRA_TYPE_VALUES } from '@shared/db'
import { TvFilesConfigFormDialog } from '../../../forms'
import TvDetailExtraItem from './extra-item.vue'
import TvDetailSeasonGroup from './season-group.vue'
import TvEpisodeDetailDialog from './episode-detail-dialog.vue'
import TvExtraDetailDialog from './extra-detail-dialog.vue'
import TvExtraFormDialog from './extra-form-dialog.vue'
import TvSeasonFormDialog from './season-form-dialog.vue'

const { tv, seasons, episodes, extras } = useTv()
const { m } = useI18n()
const { isSyncing, syncFiles } = useTvFileSync()

const addSeasonOpen = ref(false)
const filesConfigOpen = ref(false)
const openEpisodeId = ref<string | null>(null)

const watchedCount = computed(() => episodes.value.filter((episode) => episode.watched).length)

const canSyncFiles = computed(() => !!tv.value?.tvDirPath)

const episodeDetailOpen = computed({
  get: () => openEpisodeId.value !== null,
  set: (value) => {
    if (!value) openEpisodeId.value = null
  }
})

async function handleSyncFiles(): Promise<void> {
  const current = tv.value
  if (!current) return
  if (!current.tvDirPath) {
    notify.error(m.value.tv.detail.tvDirNotSet)
    return
  }

  await syncFiles(current.id)
}

// =============================================================================
// Season collapse (ids of the collapsed seasons; expanded is the default)
// =============================================================================

const collapsedSeasonIds = ref(new Set<string>())

const allCollapsed = computed(
  () =>
    seasons.value.length > 0 &&
    seasons.value.every((season) => collapsedSeasonIds.value.has(season.id))
)

function toggleSeason(seasonId: string): void {
  const next = new Set(collapsedSeasonIds.value)
  if (next.has(seasonId)) {
    next.delete(seasonId)
  } else {
    next.add(seasonId)
  }
  collapsedSeasonIds.value = next
}

function toggleAllSeasons(): void {
  collapsedSeasonIds.value = allCollapsed.value
    ? new Set()
    : new Set(seasons.value.map((season) => season.id))
}

// =============================================================================
// Extras
// =============================================================================

const addExtraOpen = ref(false)
const openExtraId = ref<string | null>(null)

/** Single list in canonical type order; the row badge carries the type. */
const sortedExtras = computed(() =>
  [...extras.value].sort(
    (a, b) => TV_EXTRA_TYPE_VALUES.indexOf(a.type) - TV_EXTRA_TYPE_VALUES.indexOf(b.type)
  )
)

const extraDetailOpen = computed({
  get: () => openExtraId.value !== null,
  set: (value) => {
    if (!value) openExtraId.value = null
  }
})
</script>

<template>
  <div
    v-if="tv"
    class="space-y-6"
  >
    <Section :title="m.tv.seasons.title">
      <template #actions>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground">
            {{ m.tv.episodes.progress({ watched: watchedCount, total: episodes.length }) }}
          </span>

          <Button
            v-if="seasons.length > 0"
            variant="outline"
            size="sm"
            @click="toggleAllSeasons"
          >
            <Icon
              :icon="
                allCollapsed
                  ? 'icon-[mdi--unfold-more-horizontal]'
                  : 'icon-[mdi--unfold-less-horizontal]'
              "
              class="size-4 mr-1.5"
            />
            {{ allCollapsed ? m.tv.seasons.expandAll : m.tv.seasons.collapseAll }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            @click="addSeasonOpen = true"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1.5"
            />
            {{ m.tv.seasons.addSeason }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            @click="filesConfigOpen = true"
          >
            <Icon
              icon="icon-[mdi--folder-cog-outline]"
              class="size-4 mr-1.5"
            />
            {{ m.tv.filesConfig.title }}
          </Button>

          <Button
            variant="outline"
            size="sm"
            :disabled="!canSyncFiles || isSyncing"
            :tooltip="canSyncFiles ? undefined : m.tv.detail.tvDirNotSet"
            @click="handleSyncFiles"
          >
            <Icon
              :icon="isSyncing ? 'icon-[mdi--loading]' : 'icon-[mdi--folder-sync-outline]'"
              :class="cn('size-4 mr-1.5', isSyncing && 'animate-spin')"
            />
            {{ m.tv.episodes.syncFiles }}
          </Button>
        </div>
      </template>

      <StateView
        v-if="seasons.length === 0"
        state="empty"
        icon="icon-[mdi--playlist-play]"
        :title="m.tv.episodes.emptyTitle"
        :description="m.tv.episodes.emptyHint"
        class="py-10"
      />
      <div
        v-else
        class="space-y-3"
      >
        <TvDetailSeasonGroup
          v-for="season in seasons"
          :key="season.id"
          :tv-id="tv.id"
          :season="season"
          :collapsed="collapsedSeasonIds.has(season.id)"
          @toggle-collapsed="toggleSeason(season.id)"
          @open-episode-detail="openEpisodeId = $event"
        />
      </div>
    </Section>

    <Section
      :title="m.tv.extras.title"
      :empty="extras.length === 0"
      :empty-text="m.tv.extras.emptyHint"
    >
      <template #actions>
        <Button
          variant="outline"
          size="sm"
          @click="addExtraOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4 mr-1.5"
          />
          {{ m.tv.extras.addExtra }}
        </Button>
      </template>

      <div class="space-y-2">
        <TvDetailExtraItem
          v-for="extra in sortedExtras"
          :key="extra.id"
          :extra="extra"
          @open-folder="revealTvFile"
          @open-detail="openExtraId = extra.id"
        />
      </div>
    </Section>

    <!-- Episode detail dialog -->
    <TvEpisodeDetailDialog
      v-if="openEpisodeId"
      v-model:open="episodeDetailOpen"
      :tv-id="tv.id"
      :episode-id="openEpisodeId"
    />

    <!-- Create season dialog -->
    <TvSeasonFormDialog
      v-if="addSeasonOpen"
      v-model:open="addSeasonOpen"
      :tv-id="tv.id"
    />

    <!-- Files configuration dialog -->
    <TvFilesConfigFormDialog
      v-if="filesConfigOpen"
      v-model:open="filesConfigOpen"
      :tv-id="tv.id"
    />

    <!-- Extra create dialog -->
    <TvExtraFormDialog
      v-if="addExtraOpen"
      v-model:open="addExtraOpen"
      :tv-id="tv.id"
    />

    <!-- Extra detail dialog -->
    <TvExtraDetailDialog
      v-if="openExtraId"
      v-model:open="extraDetailOpen"
      :tv-id="tv.id"
      :extra-id="openExtraId"
    />
  </div>
</template>

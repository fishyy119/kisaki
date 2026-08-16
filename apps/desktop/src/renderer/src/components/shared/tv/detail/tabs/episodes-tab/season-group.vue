<!--
  TvDetailSeasonGroup
  One season block: header with the season identity, watch progress, and the
  season-scoped actions, over the collapsible episode list. Collapse state is
  owned by the parent so the tab can expand or collapse every season at once.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { eq } from 'drizzle-orm'
import { Button } from '@renderer/components/ui/button'
import { DeleteConfirmDialog } from '@renderer/components/ui/delete-confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import type { TvSeasonEntry } from '@renderer/composables/use-tv'
import { revealTvFile } from '@renderer/composables/use-tv-file-records'
import { toggleTvEpisodeWatched } from '@renderer/composables/use-tv-watch'
import { db } from '@renderer/core/db'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { cn } from '@renderer/utils/cn'
import { tvSeasons } from '@shared/db'
import TvDetailEpisodeItem from './episode-item.vue'
import TvEpisodeFormDialog from './episode-form-dialog.vue'
import TvSeasonFormDialog from './season-form-dialog.vue'
import { formatTvSeasonLabel } from './season-label'

const log = createLogger('Tv')

interface Props {
  tvId: string
  season: TvSeasonEntry
  collapsed: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleCollapsed: []
  openEpisodeDetail: [episodeId: string]
}>()

const { m, f } = useI18n()

const addEpisodeOpen = ref(false)
const editSeasonOpen = ref(false)
const deleteSeasonOpen = ref(false)

const label = computed(() => formatTvSeasonLabel(props.season, m.value))

const watchedCount = computed(() => props.season.episodes.filter((entry) => entry.watched).length)

/** Metadata may declare more episodes than the rows the library holds. */
const declaredEpisodes = computed(() => {
  const declared = props.season.totalEpisodes
  if (declared === null || declared <= props.season.episodes.length) return null
  return declared
})

async function handleDeleteSeason(): Promise<void> {
  try {
    await db.delete(tvSeasons).where(eq(tvSeasons.id, props.season.id))
    notify.success(m.value.tv.seasons.seasonDeleted)
  } catch (error) {
    log.error('Season delete failed:', error)
    notify.error(m.value.common.deleteFailed)
  }
}
</script>

<template>
  <div class="rounded-lg border">
    <div class="flex items-center justify-between gap-3 px-3 py-2">
      <button
        type="button"
        class="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
        :aria-expanded="!props.collapsed"
        @click="emit('toggleCollapsed')"
      >
        <Icon
          icon="icon-[mdi--chevron-down]"
          :class="
            cn(
              'size-4 text-muted-foreground shrink-0 transition-transform',
              props.collapsed && '-rotate-90'
            )
          "
        />
        <span class="text-sm font-medium truncate">{{ label }}</span>
        <span class="text-xs text-muted-foreground shrink-0">
          {{
            m.tv.episodes.progress({
              watched: watchedCount,
              total: props.season.episodes.length
            })
          }}
        </span>
        <span
          v-if="declaredEpisodes"
          class="text-xs text-muted-foreground shrink-0"
        >
          {{ m.library.fields.totalEpisodes }}: {{ declaredEpisodes }}
        </span>
        <span
          v-if="props.season.airDate"
          class="text-xs text-muted-foreground shrink-0"
        >
          {{ f.date(props.season.airDate) }}
        </span>
      </button>

      <div class="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          :tooltip="m.tv.episodes.addEpisode"
          @click="addEpisodeOpen = true"
        >
          <Icon
            icon="icon-[mdi--plus]"
            class="size-4"
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
            >
              <Icon
                icon="icon-[mdi--dots-horizontal]"
                class="size-4"
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @click="editSeasonOpen = true">
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-4"
              />
              {{ m.tv.seasons.editSeason }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              @click="deleteSeasonOpen = true"
            >
              <Icon
                icon="icon-[mdi--delete-outline]"
                class="size-4"
              />
              {{ m.tv.seasons.deleteSeason }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div
      v-if="!props.collapsed"
      class="px-3 pb-3 space-y-2"
    >
      <p
        v-if="props.season.episodes.length === 0"
        class="text-sm text-muted-foreground py-3 text-center"
      >
        {{ m.tv.episodes.emptyHint }}
      </p>
      <TvDetailEpisodeItem
        v-for="episode in props.season.episodes"
        :key="episode.id"
        :tv-id="props.tvId"
        :episode="episode"
        @toggle-watched="toggleTvEpisodeWatched(episode)"
        @open-folder="revealTvFile"
        @open-detail="emit('openEpisodeDetail', episode.id)"
      />
    </div>

    <!-- Create episode in this season -->
    <TvEpisodeFormDialog
      v-if="addEpisodeOpen"
      v-model:open="addEpisodeOpen"
      :tv-id="props.tvId"
      :season-id="props.season.id"
    />

    <!-- Edit season -->
    <TvSeasonFormDialog
      v-if="editSeasonOpen"
      v-model:open="editSeasonOpen"
      :tv-id="props.tvId"
      :season="props.season"
    />

    <!-- Delete season confirmation (episodes cascade with it) -->
    <DeleteConfirmDialog
      v-if="deleteSeasonOpen"
      v-model:open="deleteSeasonOpen"
      :entity-label="m.tv.seasons.entityLabel"
      :entity-name="label"
      @confirm="handleDeleteSeason"
    />
  </div>
</template>

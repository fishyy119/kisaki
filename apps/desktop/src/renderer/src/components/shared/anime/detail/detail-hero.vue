<!--
  Anime Detail Hero

  Hero section for the anime detail view: cover plus the personal engagement
  facts (last watched, status, duration, score), each editable on hover.
  Work metadata such as format and episode counts lives in the overview tab.
-->

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { CoverImage } from '@renderer/components/ui/cover-image'
import { Icon } from '@renderer/components/ui/icon'
import { useAnime } from '@renderer/composables/use-anime'
import { useI18n } from '@renderer/composables/use-i18n'
import { getAttachmentUrl } from '@renderer/utils/attachment'
import { formatAnimeStatus, getEntityIcon } from '@renderer/utils/format'
import {
  EntityNameFormDialog,
  EntityOriginalNameFormDialog,
  EntityScoreFormDialog
} from '@renderer/components/shared/entity'
import {
  MediaDurationFormDialog,
  MediaLastActiveFormDialog,
  MediaStatusFormDialog
} from '@renderer/components/shared/media'

const { anime } = useAnime()
const { m, f } = useI18n()

/** Dialog open states */
const editDialogs = ref({
  name: false,
  originalName: false,
  lastActive: false,
  status: false,
  duration: false,
  score: false
})

function openEditDialog(dialog: keyof typeof editDialogs.value) {
  editDialogs.value[dialog] = true
}

const coverUrl = computed(() =>
  anime.value?.coverFile
    ? getAttachmentUrl('animes', anime.value.id, anime.value.coverFile, {
        width: 300,
        height: 400
      })
    : null
)
</script>

<template>
  <div
    v-if="anime"
    class="flex gap-4 mb-4"
  >
    <CoverImage
      :src="coverUrl"
      :alt="anime.name"
      :icon="getEntityIcon('anime')"
      class="w-28 aspect-[3/4] rounded-lg shrink-0 border shadow-raised"
    />

    <div class="flex-1 min-w-0 flex flex-col justify-between">
      <div>
        <!-- Title (Editable) -->
        <div class="group/field relative flex items-center gap-3">
          <h2 class="text-xl font-bold truncate">{{ anime.name }}</h2>
          <Button
            variant="ghost"
            size="icon-xs"
            class="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent focus:opacity-100 focus:outline-none"
            :aria-label="m.common.edit"
            @click="openEditDialog('name')"
          >
            <Icon
              icon="icon-[mdi--pencil-outline]"
              class="size-3"
            />
          </Button>
        </div>
        <!-- Original Title (Editable) -->
        <div class="group/field relative flex items-center gap-3 mt-1">
          <p class="text-sm text-muted-foreground truncate">
            {{ anime.originalName || anime.name }}
          </p>
          <Button
            variant="ghost"
            size="icon-xs"
            class="opacity-0 group-hover/field:opacity-100 transition-opacity p-0.5 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-accent focus:opacity-100 focus:outline-none"
            :aria-label="m.common.edit"
            @click="openEditDialog('originalName')"
          >
            <Icon
              icon="icon-[mdi--pencil-outline]"
              class="size-3"
            />
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-x-8 gap-y-1.5">
        <div class="grid grid-cols-[auto_1fr] gap-3 items-center text-sm">
          <span class="flex items-center gap-1.5 text-muted-foreground">
            <button
              class="group/icon size-4 relative cursor-pointer"
              :aria-label="m.common.edit"
              @click="openEditDialog('lastActive')"
            >
              <Icon
                icon="icon-[mdi--calendar-outline]"
                class="size-4 absolute inset-0 transition-opacity group-hover/icon:opacity-0"
              />
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-4 absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100"
              />
            </button>
            <span class="text-xs">{{ m.library.fields.lastWatchedAt }}</span>
          </span>
          <span class="font-medium truncate text-xs">
            {{ anime.lastActiveAt ? f.relativeTime(anime.lastActiveAt) : m.common.emptyValue }}
          </span>
        </div>

        <div class="grid grid-cols-[auto_1fr] gap-3 items-center text-sm">
          <span class="flex items-center gap-1.5 text-muted-foreground">
            <button
              class="group/icon size-4 relative cursor-pointer"
              :aria-label="m.common.edit"
              @click="openEditDialog('status')"
            >
              <Icon
                icon="icon-[mdi--bookmark-outline]"
                class="size-4 absolute inset-0 transition-opacity group-hover/icon:opacity-0"
              />
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-4 absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100"
              />
            </button>
            <span class="text-xs">{{ m.anime.detail.watchStatus }}</span>
          </span>
          <span class="font-medium truncate text-xs">{{ formatAnimeStatus(anime.status) }}</span>
        </div>

        <div class="grid grid-cols-[auto_1fr] gap-3 items-center text-sm">
          <span class="flex items-center gap-1.5 text-muted-foreground">
            <button
              class="group/icon size-4 relative cursor-pointer"
              :aria-label="m.common.edit"
              @click="openEditDialog('duration')"
            >
              <Icon
                icon="icon-[mdi--timer-outline]"
                class="size-4 absolute inset-0 transition-opacity group-hover/icon:opacity-0"
              />
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-4 absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100"
              />
            </button>
            <span class="text-xs">{{ m.library.fields.watchDuration }}</span>
          </span>
          <span class="font-medium truncate text-xs">
            {{ anime.totalDuration > 0 ? f.duration(anime.totalDuration) : m.common.emptyValue }}
          </span>
        </div>

        <div class="grid grid-cols-[auto_1fr] gap-3 items-center text-sm">
          <span class="flex items-center gap-1.5 text-muted-foreground">
            <button
              class="group/icon size-4 relative cursor-pointer"
              :aria-label="m.common.edit"
              @click="openEditDialog('score')"
            >
              <Icon
                icon="icon-[mdi--starburst-outline]"
                class="size-4 absolute inset-0 transition-opacity group-hover/icon:opacity-0"
              />
              <Icon
                icon="icon-[mdi--pencil-outline]"
                class="size-4 absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100"
              />
            </button>
            <span class="text-xs">{{ m.library.fields.myScore }}</span>
          </span>
          <span class="font-medium truncate text-xs">
            {{ anime.score !== null ? (anime.score / 10).toFixed(1) : m.common.emptyValue }}
          </span>
        </div>
      </div>
    </div>
  </div>

  <!-- Edit Dialogs - conditionally rendered with v-if -->
  <template v-if="anime">
    <EntityNameFormDialog
      v-if="editDialogs.name"
      v-model:open="editDialogs.name"
      entity-type="anime"
      :entity-id="anime.id"
    />
    <EntityOriginalNameFormDialog
      v-if="editDialogs.originalName"
      v-model:open="editDialogs.originalName"
      entity-type="anime"
      :entity-id="anime.id"
    />
    <MediaLastActiveFormDialog
      v-if="editDialogs.lastActive"
      v-model:open="editDialogs.lastActive"
      media-type="anime"
      :entity-id="anime.id"
    />
    <MediaStatusFormDialog
      v-if="editDialogs.status"
      v-model:open="editDialogs.status"
      media-type="anime"
      :entity-id="anime.id"
    />
    <MediaDurationFormDialog
      v-if="editDialogs.duration"
      v-model:open="editDialogs.duration"
      media-type="anime"
      :entity-id="anime.id"
    />
    <EntityScoreFormDialog
      v-if="editDialogs.score"
      v-model:open="editDialogs.score"
      entity-type="anime"
      :entity-id="anime.id"
    />
  </template>
</template>

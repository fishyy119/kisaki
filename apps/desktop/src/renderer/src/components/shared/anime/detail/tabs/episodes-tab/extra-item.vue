<!--
  AnimeDetailExtraItem
  One extra row: identity, type, primary-file facts, and playback. Extras carry
  no watch state, so playback starts through the untracked extra channel.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import type { AnimeExtraEntry } from '@renderer/composables/use-anime'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'

const log = createLogger('Anime')

interface Props {
  extra: AnimeExtraEntry
}

const props = defineProps<Props>()

/** Files arrive primary-first from the provider, so the head is the playable one. */
const primaryFile = computed(() => props.extra.files[0])

const emit = defineEmits<{
  openFolder: [path: string]
  edit: []
}>()

const { m, f } = useI18n()

const isPlayPending = ref(false)

async function handlePlay(): Promise<void> {
  if (isPlayPending.value) return

  isPlayPending.value = true
  try {
    const result = await ipcManager.invoke('activity:play-anime-extra', props.extra.id)
    if (!result.success) {
      notify.error(m.value.anime.extras.playFailed, result.error)
      return
    }
    if (result.data.status === 'failed') {
      notify.error(m.value.anime.extras.playFailed, m.value.activity.errors[result.data.reason])
    }
  } catch (error) {
    log.error('extra playback call threw:', error)
    notify.error(m.value.anime.extras.playFailed)
  } finally {
    isPlayPending.value = false
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50">
    <div class="flex items-center gap-3 min-w-0">
      <Icon
        icon="icon-[mdi--movie-open-outline]"
        class="size-4 text-muted-foreground shrink-0"
      />
      <div class="min-w-0">
        <p class="text-sm font-medium truncate">{{ props.extra.name }}</p>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{{ m.library.animeExtraType[props.extra.type] }}</span>
          <template v-if="primaryFile?.durationMs">
            <span>·</span>
            <span>{{ f.duration(primaryFile.durationMs) }}</span>
          </template>
          <template v-if="props.extra.files.length > 1">
            <span>·</span>
            <span>{{ m.anime.extras.fileCount({ count: props.extra.files.length }) }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.anime.extras.editTitle"
        @click="emit('edit')"
      >
        <Icon
          icon="icon-[mdi--pencil-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="primaryFile"
        variant="ghost"
        size="icon-sm"
        :tooltip="m.anime.files.openFolder"
        @click="emit('openFolder', primaryFile.path)"
      >
        <Icon
          icon="icon-[mdi--folder-open-outline]"
          class="size-4"
        />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        :disabled="isPlayPending || !primaryFile"
        :tooltip="m.anime.extras.play"
        @click="handlePlay"
      >
        <Icon
          icon="icon-[mdi--play]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>

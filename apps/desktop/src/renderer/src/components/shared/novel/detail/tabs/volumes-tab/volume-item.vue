<!--
  NovelDetailVolumeItem
  One volume row: identity, read state, file facts, and the edit action.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Icon } from '@renderer/components/ui/icon'
import NovelReadButton from '../../../novel-read-button.vue'
import { useI18n } from '@renderer/composables/use-i18n'
import { cn } from '@renderer/utils/cn'
import { formatUnitNumber } from '@renderer/utils/format'
import type { NovelVolumeEntry } from '@renderer/composables/use-novel'

interface Props {
  volume: NovelVolumeEntry
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleRead: []
  /** Carries the readable file path so the parent never re-derives it. */
  openFolder: [path: string]
  showDetail: []
}>()

const { m, f } = useI18n()

const isRead = computed(() => props.volume.read)
const readableFile = computed(() => props.volume.files[0] ?? null)

const numberLabel = computed(() =>
  props.volume.volumeNumber !== null ? formatUnitNumber(props.volume.volumeNumber) : null
)

const title = computed(() => {
  if (props.volume.name) return props.volume.name
  if (props.volume.volumeNumber !== null) {
    return m.value.novel.volumes.unnamed({ number: formatUnitNumber(props.volume.volumeNumber) })
  }
  return m.value.common.emptyValue
})

const resumePercent = computed(() =>
  props.volume.resumeProgress !== null ? Math.round(props.volume.resumeProgress * 100) : null
)
</script>

<template>
  <div
    :class="
      cn(
        'flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/50',
        !readableFile && 'opacity-70'
      )
    "
  >
    <div class="flex items-center gap-3 min-w-0">
      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="isRead ? m.novel.volumes.markUnread : m.novel.volumes.markRead"
        @click="emit('toggleRead')"
      >
        <Icon
          :icon="isRead ? 'icon-[mdi--circle]' : 'icon-[mdi--circle-outline]'"
          :class="cn('size-4', isRead && 'text-success')"
        />
      </Button>

      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            v-if="numberLabel"
            class="text-xs font-mono text-muted-foreground shrink-0"
          >
            {{ numberLabel }}
          </span>
          <p class="text-sm font-medium truncate">{{ title }}</p>
        </div>

        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span v-if="!readableFile">{{ m.novel.files.missingFile }}</span>
          <template v-else>
            <span>{{ readableFile.container }}</span>
            <template v-if="props.volume.files.length > 1">
              <span>·</span>
              <span>{{ m.novel.files.fileCount({ count: props.volume.files.length }) }}</span>
            </template>
          </template>
          <template v-if="props.volume.releaseDate">
            <span>·</span>
            <span>{{ f.date(props.volume.releaseDate) }}</span>
          </template>
          <template v-if="resumePercent !== null">
            <span>·</span>
            <span>{{ m.novel.volumes.resumeProgress({ percent: resumePercent }) }}</span>
          </template>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-1 shrink-0">
      <NovelReadButton
        v-if="readableFile"
        :novel-id="props.volume.novelId"
        :volume-id="props.volume.id"
        display="icon"
        size="sm"
      />

      <Button
        variant="ghost"
        size="icon-sm"
        :tooltip="m.novel.files.title"
        @click="emit('showDetail')"
      >
        <Icon
          icon="icon-[mdi--information-outline]"
          class="size-4"
        />
      </Button>

      <Button
        v-if="readableFile"
        variant="ghost"
        size="icon-sm"
        :tooltip="m.novel.files.openFolder"
        @click="emit('openFolder', readableFile.path)"
      >
        <Icon
          icon="icon-[mdi--folder-open-outline]"
          class="size-4"
        />
      </Button>
    </div>
  </div>
</template>

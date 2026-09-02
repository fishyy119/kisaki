<!--
  Comic Detail Activity Tab

  Activity tab showing comic reading history, statistics and charts. Uses the
  shared media activity panel with unit names as session titles.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useComic } from '@renderer/composables/use-comic'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatUnitNumber } from '@renderer/utils/format'
import { MediaActivityPanel } from '@renderer/components/shared/media'

const { chapters, sessions, isLoading, error } = useComic()
const { m } = useI18n()

const state = useRenderState(isLoading, error, sessions)

const chapterNames = computed(
  () => new Map(chapters.value.map((chapter) => [chapter.id, formatChapterName(chapter)]))
)

function formatChapterName(chapter: {
  volumeNumber: number | null
  chapterNumber: number | null
  name: string | null
}): string {
  if (chapter.name) return chapter.name
  if (chapter.chapterNumber !== null) {
    return m.value.comic.chapters.unnamedChapter({
      number: formatUnitNumber(chapter.chapterNumber)
    })
  }
  if (chapter.volumeNumber !== null) {
    return m.value.comic.chapters.unnamedVolume({ number: formatUnitNumber(chapter.volumeNumber) })
  }
  return m.value.values.emptyValue
}

function sessionTitle(session: { chapterId?: string | null }): string {
  if (!session.chapterId) return m.value.values.emptyValue
  return chapterNames.value.get(session.chapterId) ?? m.value.values.emptyValue
}
</script>

<template>
  <!-- Loading / Error -->
  <StateView
    v-if="state !== 'success'"
    :state="state"
    class="py-8"
  />

  <MediaActivityPanel
    v-else
    media-type="comic"
    :sessions="sessions"
  >
    <template #session-title="{ session }">
      {{ sessionTitle(session) }}
    </template>
  </MediaActivityPanel>
</template>

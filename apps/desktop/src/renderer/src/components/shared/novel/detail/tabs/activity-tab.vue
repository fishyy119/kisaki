<!--
  Novel Detail Activity Tab

  Activity tab showing novel reading history, statistics and charts. Uses the
  shared media activity panel with volume names as session titles.
-->

<script setup lang="ts">
import { computed } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { useRenderState } from '@renderer/composables'
import { useNovel } from '@renderer/composables/use-novel'
import { useI18n } from '@renderer/composables/use-i18n'
import { formatUnitNumber } from '@renderer/utils/format'
import { MediaActivityPanel } from '@renderer/components/shared/media'

const { volumes, sessions, isLoading, error } = useNovel()
const { m } = useI18n()

const state = useRenderState(isLoading, error, sessions)

const volumeNames = computed(
  () => new Map(volumes.value.map((volume) => [volume.id, formatVolumeName(volume)]))
)

function formatVolumeName(volume: { volumeNumber: number | null; name: string | null }): string {
  if (volume.name) return volume.name
  if (volume.volumeNumber === null) return m.value.values.emptyValue
  return m.value.novel.volumes.unnamed({ number: formatUnitNumber(volume.volumeNumber) })
}

function sessionTitle(session: { volumeId?: string | null }): string {
  if (!session.volumeId) return m.value.values.emptyValue
  return volumeNames.value.get(session.volumeId) ?? m.value.values.emptyValue
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
    media-type="novel"
    :sessions="sessions"
  >
    <template #session-title="{ session }">
      {{ sessionTitle(session) }}
    </template>
  </MediaActivityPanel>
</template>

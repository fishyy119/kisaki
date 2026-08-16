<!--
  TvWatchCatchUpDialog
  Offers to bring an entry's episodes along after its watch status was set to
  completed. Only unwatched episodes are marked, in the scope the user picks,
  and marking records the watch state alone: no playback happened, so no
  playback time is invented.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { useAsyncData } from '@renderer/composables'
import {
  markTvEpisodesWatched,
  readUnwatchedTvEpisodeCounts,
  type TvEpisodeGroup
} from '@renderer/composables/use-tv-watch'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'

const log = createLogger('Tv')

/** Season 0 is the industry's own encoding for specials; regular seasons follow. */
const TV_EPISODE_GROUPS: readonly TvEpisodeGroup[] = ['regular', 'special']

interface Props {
  tvId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const { data: counts, isLoading } = useAsyncData(() => readUnwatchedTvEpisodeCounts(props.tvId), {
  watch: [() => props.tvId],
  enabled: () => open.value
})

/** Groups with something left to mark, in display order; empty while loading. */
const pending = computed(() =>
  TV_EPISODE_GROUPS.map((group) => ({ group, count: counts.value?.[group] ?? 0 })).filter(
    (entry) => entry.count > 0
  )
)

const pendingTotal = computed(() => pending.value.reduce((total, entry) => total + entry.count, 0))

// Narrowing the scope only makes sense when specials would otherwise come along.
const canMarkRegularOnly = computed(
  () => pending.value.length > 1 && pending.value.some((entry) => entry.group === 'regular')
)

const isMarking = ref(false)

async function mark(groups: readonly TvEpisodeGroup[]): Promise<void> {
  const marked = groups.reduce((total, group) => total + (counts.value?.[group] ?? 0), 0)

  isMarking.value = true
  try {
    await markTvEpisodesWatched(props.tvId, groups)
    notify.success(m.value.tv.episodes.catchUp.marked({ count: marked }))
    open.value = false
  } catch (error) {
    log.error('Episode catch-up failed:', error)
    notify.error(m.value.library.feedback.updateFailed)
  } finally {
    isMarking.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <template v-if="isLoading">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <DialogHeader>
          <DialogTitle>{{ m.tv.episodes.catchUp.title }}</DialogTitle>
        </DialogHeader>

        <DialogBody class="space-y-3">
          <div class="space-y-1">
            <p class="text-sm">
              {{ m.tv.episodes.catchUp.pendingCount({ count: pendingTotal }) }}
            </p>
            <ul class="text-xs text-muted-foreground">
              <li
                v-for="entry in pending"
                :key="entry.group"
              >
                {{ m.tv.episodes.catchUp.pendingByType[entry.group]({ count: entry.count }) }}
              </li>
            </ul>
          </div>

          <p class="text-xs text-muted-foreground">{{ m.tv.episodes.catchUp.hint }}</p>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isMarking"
            @click="open = false"
          >
            {{ m.tv.episodes.catchUp.skip }}
          </Button>
          <Button
            v-if="canMarkRegularOnly"
            type="button"
            variant="secondary"
            :disabled="isMarking"
            @click="mark(['regular'])"
          >
            {{ m.tv.episodes.catchUp.markRegularOnly }}
          </Button>
          <Button
            type="button"
            :disabled="isMarking"
            @click="mark(TV_EPISODE_GROUPS)"
          >
            {{ m.tv.episodes.catchUp.markAll }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>

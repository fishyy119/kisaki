<!--
  AnimeWatchCatchUpDialog
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
  markEpisodesWatched,
  readUnwatchedEpisodeCounts
} from '@renderer/composables/anime-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { ANIME_EPISODE_TYPE_VALUES, type AnimeEpisodeType } from '@shared/db'

const log = createLogger('Library')

interface Props {
  animeId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const { data: counts, isLoading } = useAsyncData(() => readUnwatchedEpisodeCounts(props.animeId), {
  watch: [() => props.animeId],
  enabled: () => open.value
})

/** Kinds with something left to mark, in display order; empty while loading. */
const pending = computed(() =>
  ANIME_EPISODE_TYPE_VALUES.map((type) => ({ type, count: counts.value?.[type] ?? 0 })).filter(
    (entry) => entry.count > 0
  )
)

const pendingTotal = computed(() => pending.value.reduce((total, entry) => total + entry.count, 0))

// Narrowing the scope only makes sense when specials would otherwise come along.
const canMarkRegularOnly = computed(
  () => pending.value.length > 1 && pending.value.some((entry) => entry.type === 'regular')
)

const isMarking = ref(false)

async function mark(types: readonly AnimeEpisodeType[]): Promise<void> {
  const marked = types.reduce((total, type) => total + (counts.value?.[type] ?? 0), 0)

  isMarking.value = true
  try {
    await markEpisodesWatched(props.animeId, types)
    notify.success(m.value.anime.episodes.catchUp.marked({ count: marked }))
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
          <DialogTitle>{{ m.anime.episodes.catchUp.title }}</DialogTitle>
        </DialogHeader>

        <DialogBody class="space-y-3">
          <div class="space-y-1">
            <p class="text-sm">
              {{ m.anime.episodes.catchUp.pendingCount({ count: pendingTotal }) }}
            </p>
            <ul class="text-xs text-muted-foreground">
              <li
                v-for="entry in pending"
                :key="entry.type"
              >
                {{ m.anime.episodes.catchUp.pendingByType[entry.type]({ count: entry.count }) }}
              </li>
            </ul>
          </div>

          <p class="text-xs text-muted-foreground">{{ m.anime.episodes.catchUp.hint }}</p>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isMarking"
            @click="open = false"
          >
            {{ m.anime.episodes.catchUp.skip }}
          </Button>
          <Button
            v-if="canMarkRegularOnly"
            type="button"
            variant="secondary"
            :disabled="isMarking"
            @click="mark(['regular'])"
          >
            {{ m.anime.episodes.catchUp.markRegularOnly }}
          </Button>
          <Button
            type="button"
            :disabled="isMarking"
            @click="mark(ANIME_EPISODE_TYPE_VALUES)"
          >
            {{ m.anime.episodes.catchUp.markAll }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>

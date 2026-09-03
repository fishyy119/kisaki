<!--
  ComicReadCatchUpDialog
  Offers to bring an entry's units along after its read status was set to
  completed. Only unread units are marked, and marking records the read state
  alone: no reading happened, so no reading time is invented.
-->
<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { useLiveQuery } from '@renderer/composables'
import { markChaptersRead, readUnreadChapterCount } from '@renderer/composables/comic-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'

const log = createLogger('Library')

interface Props {
  comicId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const { data: pending, isLoading } = useLiveQuery(() => readUnreadChapterCount(props.comicId), {
  watch: [() => props.comicId],
  enabled: () => open.value
})

const isMarking = ref(false)

async function markAll(): Promise<void> {
  const marked = pending.value ?? 0

  isMarking.value = true
  try {
    await markChaptersRead(props.comicId)
    notify.success(m.value.comic.chapters.catchUp.marked({ count: marked }))
    open.value = false
  } catch (error) {
    log.error('Comic read catch-up failed:', error)
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
          <DialogTitle>{{ m.comic.chapters.catchUp.title }}</DialogTitle>
        </DialogHeader>

        <DialogBody class="space-y-3">
          <p class="text-sm">
            {{ m.comic.chapters.catchUp.pendingCount({ count: pending ?? 0 }) }}
          </p>
          <p class="text-xs text-muted-foreground">{{ m.comic.chapters.catchUp.hint }}</p>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isMarking"
            @click="open = false"
          >
            {{ m.comic.chapters.catchUp.skip }}
          </Button>
          <Button
            type="button"
            :disabled="isMarking"
            @click="markAll"
          >
            {{ m.comic.chapters.catchUp.markAll }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>

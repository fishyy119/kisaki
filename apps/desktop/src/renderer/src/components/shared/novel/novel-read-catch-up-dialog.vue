<!--
  NovelReadCatchUpDialog
  Offers to bring an entry's volumes along after its read status was set to
  completed. Only unread volumes are marked, and marking records the read state
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
import { markVolumesRead, readUnreadVolumeCount } from '@renderer/composables/novel-completion'
import { useI18n } from '@renderer/composables/use-i18n'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'

const log = createLogger('Library')

interface Props {
  novelId: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const { data: pending, isLoading } = useLiveQuery(() => readUnreadVolumeCount(props.novelId), {
  watch: [() => props.novelId],
  enabled: () => open.value
})

const isMarking = ref(false)

async function markAll(): Promise<void> {
  const marked = pending.value ?? 0

  isMarking.value = true
  try {
    await markVolumesRead(props.novelId)
    notify.success(m.value.novel.volumes.catchUp.marked({ count: marked }))
    open.value = false
  } catch (error) {
    log.error('Novel read catch-up failed:', error)
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
          <DialogTitle>{{ m.novel.volumes.catchUp.title }}</DialogTitle>
        </DialogHeader>

        <DialogBody class="space-y-3">
          <p class="text-sm">
            {{ m.novel.volumes.catchUp.pendingCount({ count: pending ?? 0 }) }}
          </p>
          <p class="text-xs text-muted-foreground">{{ m.novel.volumes.catchUp.hint }}</p>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            :disabled="isMarking"
            @click="open = false"
          >
            {{ m.novel.volumes.catchUp.skip }}
          </Button>
          <Button
            type="button"
            :disabled="isMarking"
            @click="markAll"
          >
            {{ m.novel.volumes.catchUp.markAll }}
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>

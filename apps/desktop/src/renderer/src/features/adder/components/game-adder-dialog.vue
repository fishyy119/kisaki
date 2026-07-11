<!--
  GameAdderDialog
  Dialog for adding games to the library.
  Uses GameSearcher component for search and identification.
-->
<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils/format'
import { ipcManager } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { GameSearcher, type GameSearcherSelection } from '@renderer/components/shared/game'
import type { IngestAddGameFromScraperResult } from '@shared/ingest/add'

interface Props {
  /** Target collection ID to add the game to */
  targetCollectionId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** Called after game is successfully added */
  success: [gameId: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const isSubmitting = ref(false)
const selection = ref<GameSearcherSelection>({
  profileId: '',
  gameId: '',
  gameName: '',
  originalName: '',
  knownIds: [],
  canSubmit: false
})

function handleSelectionChange(newSelection: GameSearcherSelection) {
  selection.value = newSelection
}

async function handleSubmit() {
  if (!selection.value.canSubmit) return

  isSubmitting.value = true

  const profileId = selection.value.profileId
  const name = selection.value.originalName ?? selection.value.gameName
  const knownIds = toRaw(selection.value.knownIds)
  const targetCollectionId = props.targetCollectionId

  open.value = false
  try {
    const result = await ipcManager.invoke(
      'ingest:add-game-from-scraper',
      profileId,
      { name, knownIds },
      { targetCollectionId }
    )

    if (!result.success) {
      notify.error('添加游戏失败', result.error)
      return
    }

    const waitResult = await ipcManager.invoke('task-run:wait', result.data.runId)
    if (!waitResult.success) {
      notify.error('添加游戏失败', waitResult.error)
      return
    }

    const run = waitResult.data
    if (run.status === 'cancelled') {
      notify.info('添加游戏已取消')
      return
    }
    if (run.status !== 'completed') {
      notify.error('添加游戏失败', run.result?.error)
      return
    }

    const output = run.result?.output as IngestAddGameFromScraperResult | undefined
    if (!output?.gameId) {
      notify.error('添加游戏失败', '任务结果缺少游戏 ID')
      return
    }

    emit('success', output.gameId)
  } catch (error) {
    notify.error('添加游戏失败', (error as Error).message)
  } finally {
    isSubmitting.value = false
  }
}

// v-model wrapper for Dialog
const openModel = computed({
  get: () => open.value,
  set: (newOpen: boolean) => {
    open.value = newOpen
  }
})
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            :icon="getEntityIcon('game')"
            class="size-4"
          />
          添加游戏
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <GameSearcher
          :is-submitting="isSubmitting"
          @selection-change="handleSelectionChange"
        />
      </DialogBody>
      <DialogFooter>
        <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground mr-auto">
          <Icon
            icon="icon-[mdi--lightbulb-outline]"
            class="size-3.5"
          />
          <span>点击搜索结果自动填充 ID</span>
        </div>
        <Button
          variant="outline"
          :disabled="isSubmitting"
          @click="openModel = false"
        >
          取消
        </Button>
        <Button
          :disabled="!selection.canSubmit || isSubmitting"
          @click="handleSubmit"
        >
          <template v-if="isSubmitting">
            <Icon
              icon="icon-[mdi--loading]"
              class="size-4 animate-spin"
            />
            添加中...
          </template>
          <template v-else>
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4"
            />
            识别并添加
          </template>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<!--
  GameIngestDialog
  Dialog for adding games to the library.
  Uses GameSearcher component for search and identification.
-->
<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { getEntityIcon } from '@renderer/utils'
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
import { getIngestWarningMessage } from './utils'

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
  const toastId = notify.loading(`正在添加游戏「${selection.value.gameName}」中...`)

  try {
    const result = await ipcManager.invoke(
      'ingest:add-game-from-scraper',
      profileId,
      { name, knownIds },
      { targetCollectionId }
    )

    if (!result.success) {
      notify.update(toastId, { title: '添加游戏失败', message: result.error, type: 'error' })
      return
    }

    if (result.data.isNew) {
      const warningMessage = getIngestWarningMessage(result.data.warnings)
      notify.update(toastId, {
        title: warningMessage ? '游戏添加完成' : '游戏添加成功',
        message: warningMessage,
        type: warningMessage ? 'warning' : 'success'
      })
    } else {
      const reasonText = result.data.existingReason === 'path' ? '路径' : '外部 ID'
      notify.update(toastId, { title: '游戏已存在', message: `${reasonText}匹配`, type: 'info' })
    }

    emit('success', result.data.gameId)
  } catch (error) {
    notify.update(toastId, {
      title: '添加游戏失败',
      message: (error as Error).message,
      type: 'error'
    })
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

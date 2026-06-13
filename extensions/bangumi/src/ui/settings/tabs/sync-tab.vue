<!--
Sync Tab edits auto-sync settings and runs changed/full sync jobs, including
the full-sync preview dialog.
Boundary: binds the shared settings form; job calls go through `host` RPC.
-->
<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldContent,
  FieldGroup,
  Input,
  Label,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type {
  BangumiAutoSyncItem,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview,
  BangumiSyncDataItem
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { host, onHostPreviewProgress, toErrorMessage } from '../rpc'
import PreviewGroups from '../components/preview-groups.vue'

interface Props {
  overview: BangumiSettingsOverview
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'refresh'): void
  (e: 'error', message: string): void
}>()

const AUTO_SYNC_ITEMS: readonly { value: BangumiAutoSyncItem; label: string }[] = [
  { value: 'create', label: '创建收藏' },
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
]

const FULL_SYNC_ITEMS: readonly { value: BangumiSyncDataItem; label: string }[] = [
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
]

const syncing = ref(false)
const fullSyncOpen = ref(false)
const fullSyncBusy = ref<'preview' | 'run' | null>(null)
const fullSyncPreview = ref<readonly BangumiPreviewGroupDto[] | null>(null)
const previewProgress = ref<string | null>(null)
const fullSyncForm = reactive({
  items: ['status', 'score'] as BangumiSyncDataItem[],
  updateExisting: true,
  clearRemoteScoreWhenEmpty: false,
  batchSize: 100
})

let stopProgressListener: (() => void) | null = null

onMounted(() => {
  stopProgressListener = onHostPreviewProgress((label) => {
    if (fullSyncBusy.value === 'preview') {
      previewProgress.value = label
    }
  })
})

onUnmounted(() => {
  stopProgressListener?.()
})

function toggleAutoSyncItem(item: BangumiAutoSyncItem, checked: boolean): void {
  const next = new Set(settingsForm.autoSyncItems)
  if (checked) {
    next.add(item)
  } else {
    next.delete(item)
  }
  settingsForm.autoSyncItems = [...next]
}

async function runChangedSync(): Promise<void> {
  syncing.value = true
  try {
    await host.runChangedSync()
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    syncing.value = false
  }
}

function openFullSync(): void {
  fullSyncForm.items = settingsForm.autoSyncItems.filter(
    (item): item is BangumiSyncDataItem => item === 'status' || item === 'score'
  )
  fullSyncForm.clearRemoteScoreWhenEmpty = settingsForm.clearRemoteScoreWhenEmpty
  fullSyncPreview.value = null
  previewProgress.value = null
  fullSyncOpen.value = true
}

function toggleFullSyncItem(item: BangumiSyncDataItem, checked: boolean): void {
  const next = new Set(fullSyncForm.items)
  if (checked) {
    next.add(item)
  } else {
    next.delete(item)
  }
  fullSyncForm.items = [...next]
}

async function previewFullSync(): Promise<void> {
  fullSyncBusy.value = 'preview'
  previewProgress.value = null
  try {
    fullSyncPreview.value = await host.previewFullSync({ ...fullSyncForm })
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    fullSyncBusy.value = null
    previewProgress.value = null
  }
}

async function runFullSync(): Promise<void> {
  fullSyncBusy.value = 'run'
  try {
    await host.runFullSync({ ...fullSyncForm })
    fullSyncOpen.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    fullSyncBusy.value = null
  }
}
</script>

<template>
  <FieldGroup>
    <Field
      orientation="horizontal"
      label="自动同步"
      description="本地游戏变更后自动同步到 Bangumi。"
    >
      <Switch v-model="settingsForm.autoSyncEnabled" />
    </Field>

    <Field
      orientation="horizontal"
      label="同步项"
    >
      <FieldContent class="flex-row items-center gap-3">
        <Label
          v-for="item in AUTO_SYNC_ITEMS"
          :key="item.value"
          class="font-normal"
        >
          <Checkbox
            :model-value="settingsForm.autoSyncItems.includes(item.value)"
            :disabled="!settingsForm.autoSyncEnabled"
            @update:model-value="(checked) => toggleAutoSyncItem(item.value, checked === true)"
          />
          {{ item.label }}
        </Label>
      </FieldContent>
    </Field>

    <Field
      orientation="horizontal"
      label="允许删除远端评分"
      description="本地评分清空时同时清除 Bangumi 评分。"
    >
      <Switch
        v-model="settingsForm.clearRemoteScoreWhenEmpty"
        :disabled="!settingsForm.autoSyncEnabled || !settingsForm.autoSyncItems.includes('score')"
      />
    </Field>

    <Field
      orientation="horizontal"
      label="手动同步"
      description="同步运行期变更队列，或配置一次全量同步。"
    >
      <FieldContent class="flex-row items-center gap-2">
        <Button
          variant="outline"
          type="button"
          :disabled="syncing || overview.activeJobs.syncChangedItems"
          @click="runChangedSync"
        >
          <Spinner v-if="syncing || overview.activeJobs.syncChangedItems" />
          立即同步
        </Button>
        <Button
          type="button"
          @click="openFullSync"
        >
          配置全量同步
        </Button>
      </FieldContent>
    </Field>
  </FieldGroup>

  <Dialog v-model:open="fullSyncOpen">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>全量同步</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-y-auto">
        <FieldGroup class="gap-4">
          <Field
            orientation="horizontal"
            label="同步数据"
          >
            <FieldContent class="flex-row items-center gap-3">
              <Label
                v-for="item in FULL_SYNC_ITEMS"
                :key="item.value"
                class="font-normal"
              >
                <Checkbox
                  :model-value="fullSyncForm.items.includes(item.value)"
                  @update:model-value="(checked) => toggleFullSyncItem(item.value, checked === true)"
                />
                {{ item.label }}
              </Label>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            label="更新已有收藏"
          >
            <Switch v-model="fullSyncForm.updateExisting" />
          </Field>

          <Field
            orientation="horizontal"
            label="允许删除远端评分"
          >
            <Switch
              v-model="fullSyncForm.clearRemoteScoreWhenEmpty"
              :disabled="!fullSyncForm.updateExisting || !fullSyncForm.items.includes('score')"
            />
          </Field>

          <Field
            orientation="horizontal"
            label="批次大小"
          >
            <Input
              v-model.number="fullSyncForm.batchSize"
              type="number"
              min="1"
              max="500"
              class="w-24"
            />
          </Field>

          <PreviewGroups
            v-if="fullSyncPreview"
            :groups="fullSyncPreview"
          />
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <span
          v-if="fullSyncBusy === 'preview' && previewProgress"
          class="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Spinner class="size-3" />
          {{ previewProgress }}
        </span>
        <Button
          variant="outline"
          type="button"
          :disabled="fullSyncBusy !== null || overview.activeJobs.syncFull"
          @click="previewFullSync"
        >
          {{ fullSyncBusy === 'preview' ? '正在预览…' : '预览将更改的游戏' }}
        </Button>
        <Button
          type="button"
          :disabled="fullSyncBusy !== null || overview.activeJobs.syncFull"
          @click="runFullSync"
        >
          执行同步
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

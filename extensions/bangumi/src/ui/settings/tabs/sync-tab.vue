<!--
Sync Tab edits auto-sync settings and runs changed/full sync jobs, including
the full-sync preview modal.
Boundary: binds the shared settings form; job calls go through `host` RPC.
-->
<script setup lang="ts">
import { reactive, ref } from 'vue'
import type {
  BangumiAutoSyncItem,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview,
  BangumiSyncDataItem
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { host, toErrorMessage } from '../rpc'
import Modal from '../components/modal.vue'
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
const fullSyncForm = reactive({
  items: ['status', 'score'] as BangumiSyncDataItem[],
  updateExisting: true,
  clearRemoteScoreWhenEmpty: false,
  batchSize: 100
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
  try {
    fullSyncPreview.value = await host.previewFullSync({ ...fullSyncForm })
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    fullSyncBusy.value = null
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
  <section>
    <div class="field">
      <div class="field-info">
        <span class="field-label">自动同步</span>
        <span class="field-hint">本地游戏变更后自动同步到 Bangumi。</span>
      </div>
      <div class="field-control">
        <input
          v-model="settingsForm.autoSyncEnabled"
          type="checkbox"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">同步项</span>
      </div>
      <div class="field-control check-group">
        <label
          v-for="item in AUTO_SYNC_ITEMS"
          :key="item.value"
        >
          <input
            type="checkbox"
            :checked="settingsForm.autoSyncItems.includes(item.value)"
            :disabled="!settingsForm.autoSyncEnabled"
            @change="toggleAutoSyncItem(item.value, ($event.target as HTMLInputElement).checked)"
          />
          {{ item.label }}
        </label>
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">允许删除远端评分</span>
        <span class="field-hint">本地评分清空时同时清除 Bangumi 评分。</span>
      </div>
      <div class="field-control">
        <input
          v-model="settingsForm.clearRemoteScoreWhenEmpty"
          type="checkbox"
          :disabled="!settingsForm.autoSyncEnabled || !settingsForm.autoSyncItems.includes('score')"
        />
      </div>
    </div>

    <div class="field">
      <div class="field-info">
        <span class="field-label">手动同步</span>
        <span class="field-hint">同步运行期变更队列，或配置一次全量同步。</span>
      </div>
      <div class="field-control">
        <button
          type="button"
          :disabled="syncing || overview.activeJobs.syncChangedItems"
          @click="runChangedSync"
        >
          立即同步
        </button>
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          @click="openFullSync"
        >
          配置全量同步
        </button>
      </div>
    </div>

    <Modal
      v-if="fullSyncOpen"
      title="全量同步"
      @close="fullSyncOpen = false"
    >
      <div class="field">
        <div class="field-info">
          <span class="field-label">同步数据</span>
        </div>
        <div class="field-control check-group">
          <label
            v-for="item in FULL_SYNC_ITEMS"
            :key="item.value"
          >
            <input
              type="checkbox"
              :checked="fullSyncForm.items.includes(item.value)"
              @change="toggleFullSyncItem(item.value, ($event.target as HTMLInputElement).checked)"
            />
            {{ item.label }}
          </label>
        </div>
      </div>
      <div class="field">
        <div class="field-info">
          <span class="field-label">更新已有收藏</span>
        </div>
        <div class="field-control">
          <input
            v-model="fullSyncForm.updateExisting"
            type="checkbox"
          />
        </div>
      </div>
      <div class="field">
        <div class="field-info">
          <span class="field-label">允许删除远端评分</span>
        </div>
        <div class="field-control">
          <input
            v-model="fullSyncForm.clearRemoteScoreWhenEmpty"
            type="checkbox"
            :disabled="!fullSyncForm.updateExisting || !fullSyncForm.items.includes('score')"
          />
        </div>
      </div>
      <div class="field">
        <div class="field-info">
          <span class="field-label">批次大小</span>
        </div>
        <div class="field-control">
          <input
            v-model.number="fullSyncForm.batchSize"
            type="number"
            min="1"
            max="500"
          />
        </div>
      </div>

      <PreviewGroups
        v-if="fullSyncPreview"
        :groups="fullSyncPreview"
      />

      <template #footer>
        <button
          type="button"
          :disabled="fullSyncBusy !== null || overview.activeJobs.syncFull"
          @click="previewFullSync"
        >
          {{ fullSyncBusy === 'preview' ? '正在预览...' : '预览将更改的游戏' }}
        </button>
        <button
          type="button"
          class="border-transparent bg-primary text-primary-foreground"
          :disabled="fullSyncBusy !== null || overview.activeJobs.syncFull"
          @click="runFullSync"
        >
          执行同步
        </button>
      </template>
    </Modal>
  </section>
</template>

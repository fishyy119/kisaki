<!-- Sync Tab edits persistent sync preferences and launches sync jobs. -->
<script setup lang="ts">
import { ref } from 'vue'
import {
  Button,
  Checkbox,
  Field,
  FieldContent,
  FieldGroup,
  Icon,
  Label,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { BangumiAutoSyncItem, BangumiSettingsOverview } from '../../../shared/settings'
import { settingsForm } from '../form'
import { host, toErrorMessage } from '../rpc'
import SettingsSection from '../components/settings-section.vue'
import FullSyncDialog from '../flows/full-sync-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const AUTO_SYNC_ITEMS: readonly { value: BangumiAutoSyncItem; label: string }[] = [
  { value: 'create', label: '创建收藏' },
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
]

const syncing = ref(false)
const fullSyncOpen = ref(false)

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
</script>

<template>
  <div class="space-y-4">
    <SettingsSection
      title="自动同步偏好"
      surface="rows"
    >
      <FieldGroup>
        <Field
          orientation="horizontal"
          label="自动同步"
          description="监听本地游戏创建和用户态字段变更。"
        >
          <Switch v-model="settingsForm.autoSyncEnabled" />
        </Field>

        <Field
          orientation="horizontal"
          label="同步项"
        >
          <FieldContent class="flex-row flex-wrap items-center gap-x-3 gap-y-2">
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
            :disabled="
              !settingsForm.autoSyncEnabled || !settingsForm.autoSyncItems.includes('score')
            "
          />
        </Field>
      </FieldGroup>
    </SettingsSection>

    <SettingsSection
      title="手动同步"
      description="立即同步变更队列，或配置一次全量同步。进度和取消由任务中心处理。"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="syncing || props.overview.activeJobs.syncChangedItems"
          @click="runChangedSync"
        >
          <Spinner v-if="syncing || props.overview.activeJobs.syncChangedItems" />
          <Icon
            v-else
            icon="icon-[mdi--sync]"
            class="size-3.5"
          />
          立即同步变更
        </Button>
        <Button
          size="sm"
          type="button"
          :disabled="props.overview.activeJobs.syncFull"
          @click="fullSyncOpen = true"
        >
          <Icon
            icon="icon-[mdi--playlist-check]"
            class="size-3.5"
          />
          全量同步
        </Button>
      </div>
    </SettingsSection>

    <FullSyncDialog
      v-if="fullSyncOpen"
      v-model:open="fullSyncOpen"
      :overview="props.overview"
      @refresh="emit('refresh')"
      @error="(message) => emit('error', message)"
    />
  </div>
</template>

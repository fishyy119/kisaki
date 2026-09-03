<!-- Full sync flow: configure one run, preview remote changes, then start the job. -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
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
  Icon,
  Input,
  Label,
  Spinner,
  Switch
} from '@kisaki3/extension-ui-vue'
import type { BangumiMediaScope } from '../../../shared/scopes'
import type {
  BangumiFullSyncFormArgs,
  BangumiPreviewGroupDto,
  BangumiSettingsOverview,
  BangumiSyncDataItem
} from '../../../shared/settings'
import { settingsForm } from '../form'
import { m } from '../i18n'
import { host, onHostPreviewProgress, toErrorMessage } from '../rpc'
import JobPreviewDialog from '../components/job-preview-dialog.vue'

interface Props {
  overview: BangumiSettingsOverview
  scope: BangumiMediaScope
}

interface FullSyncForm {
  items: BangumiSyncDataItem[]
  updateExisting: boolean
  clearRemoteScoreWhenEmpty: boolean
  batchSize: number
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  refresh: []
  error: [message: string]
}>()

const supportsUnitProgress = computed(
  () =>
    props.overview.scopes.find((option) => option.scope === props.scope)?.supportsUnitProgress ===
    true
)

const fullSyncItems = computed<readonly { value: BangumiSyncDataItem; label: string }[]>(() => [
  { value: 'status', label: m.value.ui.fullSync.itemStatus },
  { value: 'score', label: m.value.ui.fullSync.itemScore },
  ...(supportsUnitProgress.value
    ? [{ value: 'unitProgress' as const, label: m.value.ui.fullSync.itemUnitProgress }]
    : [])
])

const DEFAULT_ITEMS: readonly BangumiSyncDataItem[] = ['status', 'score']

const busy = ref<'preview' | 'run' | null>(null)
const preview = ref<readonly BangumiPreviewGroupDto[] | null>(null)
const previewOpen = ref(false)
const previewProgress = ref<string | null>(null)
const fullSyncForm = reactive<FullSyncForm>({
  items: [...DEFAULT_ITEMS],
  updateExisting: true,
  clearRemoteScoreWhenEmpty: false,
  batchSize: 100
})

let stopProgressListener: (() => void) | null = null

onMounted(() => {
  stopProgressListener = onHostPreviewProgress((label) => {
    if (busy.value === 'preview') {
      previewProgress.value = label
    }
  })
})

onUnmounted(() => {
  stopProgressListener?.()
})

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      initializeForm()
    }
  },
  { immediate: true }
)

function initializeForm(): void {
  const available = new Set(fullSyncItems.value.map((item) => item.value))
  const selectedItems = settingsForm.autoSyncItems.filter((item): item is BangumiSyncDataItem =>
    available.has(item as BangumiSyncDataItem)
  )
  fullSyncForm.items = selectedItems.length > 0 ? selectedItems : [...DEFAULT_ITEMS]
  fullSyncForm.updateExisting = true
  fullSyncForm.clearRemoteScoreWhenEmpty = settingsForm.clearRemoteScoreWhenEmpty
  fullSyncForm.batchSize = 100
  preview.value = null
  previewOpen.value = false
  previewProgress.value = null
}

function toggleFullSyncItem(item: BangumiSyncDataItem, checked: boolean): void {
  const next = new Set(fullSyncForm.items)
  if (checked) {
    next.add(item)
  } else {
    next.delete(item)
  }
  fullSyncForm.items = [...next]
  preview.value = null
  previewOpen.value = false
}

async function previewFullSync(): Promise<void> {
  busy.value = 'preview'
  previewProgress.value = null
  try {
    preview.value = await host.previewFullSync(snapshotArgs())
    previewOpen.value = true
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
    previewProgress.value = null
  }
}

async function runFullSync(): Promise<void> {
  busy.value = 'run'
  try {
    await host.runFullSync(snapshotArgs())
    previewOpen.value = false
    open.value = false
    emit('refresh')
  } catch (error) {
    emit('error', toErrorMessage(error))
  } finally {
    busy.value = null
  }
}

function snapshotArgs(): BangumiFullSyncFormArgs {
  return {
    scope: props.scope,
    items: [...fullSyncForm.items],
    updateExisting: fullSyncForm.updateExisting,
    clearRemoteScoreWhenEmpty: fullSyncForm.clearRemoteScoreWhenEmpty,
    batchSize: fullSyncForm.batchSize
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>{{ m.ui.fullSync.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldGroup class="gap-4">
          <Field
            orientation="horizontal"
            :label="m.ui.fullSync.syncData"
          >
            <FieldContent class="flex-row items-center gap-3">
              <Label
                v-for="item in fullSyncItems"
                :key="item.value"
                class="font-normal"
              >
                <Checkbox
                  :model-value="fullSyncForm.items.includes(item.value)"
                  @update:model-value="
                    (checked) => toggleFullSyncItem(item.value, checked === true)
                  "
                />
                {{ item.label }}
              </Label>
            </FieldContent>
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.fullSync.updateExisting"
            :description="m.ui.fullSync.updateExistingDescription"
          >
            <Switch v-model="fullSyncForm.updateExisting" />
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.fullSync.clearRemoteScore"
          >
            <Switch
              v-model="fullSyncForm.clearRemoteScoreWhenEmpty"
              :disabled="!fullSyncForm.updateExisting || !fullSyncForm.items.includes('score')"
            />
          </Field>

          <Field
            orientation="horizontal"
            :label="m.ui.fullSync.batchSize"
          >
            <Input
              v-model.number="fullSyncForm.batchSize"
              type="number"
              min="1"
              max="500"
              class="w-24"
            />
          </Field>
        </FieldGroup>
      </DialogBody>
      <DialogFooter>
        <span
          v-if="busy === 'preview' && previewProgress"
          class="mr-auto flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Spinner class="size-3" />
          {{ previewProgress }}
        </span>
        <Button
          variant="outline"
          size="sm"
          type="button"
          :disabled="busy !== null || props.overview.activeJobs.syncFull"
          @click="previewFullSync"
        >
          <Spinner v-if="busy === 'preview'" />
          <Icon
            v-else
            icon="icon-[mdi--eye-outline]"
            class="size-3.5"
          />
          {{ m.common.preview }}
        </Button>
        <Button
          type="button"
          :disabled="busy !== null || props.overview.activeJobs.syncFull"
          @click="runFullSync"
        >
          <Spinner v-if="busy === 'run' || props.overview.activeJobs.syncFull" />
          <Icon
            v-else
            icon="icon-[mdi--play]"
            class="size-4"
          />
          {{ m.ui.fullSync.run }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <JobPreviewDialog
    v-if="preview"
    v-model:open="previewOpen"
    :title="m.ui.fullSync.previewTitle"
    :description="m.ui.fullSync.previewDescription"
    :groups="preview"
    @error="(message) => emit('error', message)"
  >
    <template #footer>
      <Button
        type="button"
        :disabled="busy !== null || props.overview.activeJobs.syncFull"
        @click="runFullSync"
      >
        <Spinner v-if="busy === 'run' || props.overview.activeJobs.syncFull" />
        <Icon
          v-else
          icon="icon-[mdi--play]"
          class="size-4"
        />
        {{ m.ui.fullSync.run }}
      </Button>
    </template>
  </JobPreviewDialog>
</template>

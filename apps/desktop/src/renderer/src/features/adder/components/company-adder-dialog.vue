<!--
  CompanyAdderDialog
  Dialog for adding companies to the library.
  Uses CompanySearcher component for search and identification.
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
import { CompanySearcher, type CompanySearcherSelection } from '@renderer/components/shared/company'
import type { IngestAddCompanyFromScraperResult } from '@shared/ingest/add'

interface Props {
  /** Target collection ID to add the company to */
  targetCollectionId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  /** Called after company is successfully added */
  success: [companyId: string]
}>()

const open = defineModel<boolean>('open', { required: true })

const isSubmitting = ref(false)
const selection = ref<CompanySearcherSelection>({
  profileId: '',
  companyId: '',
  companyName: '',
  originalName: '',
  knownIds: [],
  canSubmit: false
})

function handleSelectionChange(newSelection: CompanySearcherSelection) {
  selection.value = newSelection
}

async function handleSubmit() {
  if (!selection.value.canSubmit) return

  isSubmitting.value = true

  const profileId = selection.value.profileId
  const name = selection.value.originalName ?? selection.value.companyName
  const knownIds = toRaw(selection.value.knownIds)
  const targetCollectionId = props.targetCollectionId

  open.value = false
  try {
    const result = await ipcManager.invoke(
      'ingest:add-company-from-scraper',
      profileId,
      {
        name,
        knownIds
      },
      {
        targetCollectionId
      }
    )

    if (!result.success) {
      notify.error('添加公司失败', result.error)
      return
    }

    const waitResult = await ipcManager.invoke('task-run:wait', result.data.runId)
    if (!waitResult.success) {
      notify.error('添加公司失败', waitResult.error)
      return
    }

    const run = waitResult.data
    if (run.status === 'cancelled') {
      notify.info('添加公司已取消')
      return
    }
    if (run.status !== 'completed') {
      notify.error('添加公司失败', run.result?.error)
      return
    }

    const output = run.result?.output as IngestAddCompanyFromScraperResult | undefined
    if (!output?.companyId) {
      notify.error('添加公司失败', '任务结果缺少公司 ID')
      return
    }

    emit('success', output.companyId)
  } catch (error) {
    notify.error('添加公司失败', (error as Error).message)
  } finally {
    isSubmitting.value = false
  }
}

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
            :icon="getEntityIcon('company')"
            class="size-4"
          />
          添加公司
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <CompanySearcher
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

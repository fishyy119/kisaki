<script setup lang="ts">
/**
 * Scanner Settings Form Dialog
 *
 * Dialog for configuring scanner settings.
 * Allows editing auto-scan, ingest mode, pHash assist and ignored names.
 */

import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import {
  SCANNER_PARALLEL_COUNT_DEFAULT,
  SCANNER_PARALLEL_COUNT_MAX,
  SCANNER_PARALLEL_COUNT_MIN,
  settings,
  type ScannerIngestMode
} from '@shared/db'
import { notify } from '@renderer/core/notify'
import { useAsyncData, useRenderState } from '@renderer/composables'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Switch } from '@renderer/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import {
  Field,
  FieldLabel,
  FieldContent,
  FieldGroup,
  FieldDescription
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { Spinner } from '@renderer/components/ui/spinner'

// =============================================================================
// Model
// =============================================================================

const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// State
// =============================================================================

const isSaving = ref(false)

interface FormData {
  ignoredNames: string[]
  ingestMode: ScannerIngestMode
  usePhash: boolean
  startAtOpen: boolean
  parallelCount: number
  newIgnoredName: string
}

const scannerIngestModeOptions = [
  {
    value: 'prefer-scraper',
    label: '优先刮削',
    description: '优先使用刮削导入，失败时回退到直接入库'
  },
  {
    value: 'require-scraper',
    label: '必须刮削',
    description: '必须通过刮削导入，刮削失败时直接记为失败'
  },
  {
    value: 'direct-only',
    label: '仅直接入库',
    description: '跳过刮削，直接按识别结果创建游戏'
  }
] as const satisfies readonly {
  value: ScannerIngestMode
  label: string
  description: string
}[]

function createDefaultFormData(): FormData {
  return {
    ignoredNames: [],
    ingestMode: 'prefer-scraper',
    usePhash: false,
    startAtOpen: false,
    parallelCount: SCANNER_PARALLEL_COUNT_DEFAULT,
    newIgnoredName: ''
  }
}

function createFormDataFromSettings(data: {
  ignoredNames: string[]
  ingestMode: ScannerIngestMode
  usePhash: boolean
  startAtOpen: boolean
  parallelCount: number
}): FormData {
  return {
    ignoredNames: [...data.ignoredNames],
    ingestMode: data.ingestMode,
    usePhash: data.usePhash,
    startAtOpen: data.startAtOpen,
    parallelCount: data.parallelCount,
    newIgnoredName: ''
  }
}

const formData = ref<FormData>(createDefaultFormData())

const openModel = computed({
  get: () => open.value,
  set: (value) => {
    if (!isSaving.value) {
      open.value = value
    }
  }
})

// =============================================================================
// Load Data on Open
// =============================================================================

const { data, isLoading, error, refetch } = useAsyncData(
  async () => {
    const result = await db.query.settings.findFirst()
    if (!result) {
      throw new Error('Settings not found')
    }
    return {
      ignoredNames: [...result.scannerIgnoredNames],
      ingestMode: result.scannerIngestMode,
      usePhash: result.scannerUsePhash,
      startAtOpen: result.scannerStartAtOpen,
      parallelCount: result.scannerParallelCount
    }
  },
  { enabled: open }
)
const state = useRenderState(isLoading, error, data)

// Initialize form when data loads
watch(data, (d) => {
  if (!d) return
  formData.value = createFormDataFromSettings(d)
})

// =============================================================================
// Handlers
// =============================================================================

function handleAddIgnoredName() {
  const trimmedName = formData.value.newIgnoredName.trim()
  if (trimmedName && !formData.value.ignoredNames.includes(trimmedName)) {
    formData.value.ignoredNames = [...formData.value.ignoredNames, trimmedName]
    formData.value.newIgnoredName = ''
  }
}

function handleRemoveIgnoredName(name: string) {
  formData.value.ignoredNames = formData.value.ignoredNames.filter((n) => n !== name)
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleAddIgnoredName()
  }
}

const parallelCountModel = computed({
  get: () => formData.value.parallelCount,
  set: (value: string | number | undefined) => {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
    formData.value.parallelCount = Number.isNaN(num)
      ? SCANNER_PARALLEL_COUNT_DEFAULT
      : Math.max(SCANNER_PARALLEL_COUNT_MIN, Math.min(SCANNER_PARALLEL_COUNT_MAX, num))
  }
})

async function handleSubmit() {
  isSaving.value = true
  try {
    await db
      .update(settings)
      .set({
        scannerIgnoredNames: formData.value.ignoredNames,
        scannerIngestMode: formData.value.ingestMode,
        scannerUsePhash: formData.value.usePhash,
        scannerStartAtOpen: formData.value.startAtOpen,
        scannerParallelCount: formData.value.parallelCount
      })
      .where(eq(settings.id, 0))
      .run()
    notify.success('设置已保存')
    open.value = false
  } catch (error) {
    notify.error('保存失败', error instanceof Error ? error.message : String(error))
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="openModel">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>扫描器设置</DialogTitle>
      </DialogHeader>

      <template v-if="state === 'loading'">
        <DialogBody class="flex items-center justify-center py-8">
          <Spinner class="size-8" />
        </DialogBody>
      </template>

      <template v-else-if="state === 'error'">
        <DialogBody class="space-y-3">
          <p class="text-sm text-destructive">
            {{ error }}
          </p>
          <div class="flex justify-end">
            <Button
              type="button"
              variant="outline"
              @click="refetch"
            >
              重试
            </Button>
          </div>
        </DialogBody>
      </template>

      <template v-else>
        <Form @submit="handleSubmit">
          <DialogBody class="max-h-[60vh] overflow-auto">
            <FieldGroup>
              <Field orientation="horizontal">
                <FieldLabel>启动时自动扫描</FieldLabel>
                <FieldDescription>打开应用时自动运行所有扫描器</FieldDescription>
                <FieldContent>
                  <Switch v-model="formData.startAtOpen" />
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>入库模式</FieldLabel>
                <FieldDescription>控制扫描器识别到新游戏后的导入策略</FieldDescription>
                <FieldContent>
                  <Select v-model="formData.ingestMode">
                    <SelectTrigger class="w-32">
                      <span class="truncate">
                        {{
                          scannerIngestModeOptions.find(
                            (option) => option.value === formData.ingestMode
                          )?.label ?? formData.ingestMode
                        }}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in scannerIngestModeOptions"
                        :key="option.value"
                        :value="option.value"
                        :description="option.description"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>pHash 辅助刮削</FieldLabel>
                <FieldDescription>实验性功能</FieldDescription>
                <FieldContent>
                  <Switch v-model="formData.usePhash" />
                </FieldContent>
              </Field>

              <Field orientation="horizontal">
                <FieldLabel>并行处理数</FieldLabel>
                <FieldDescription>
                  控制单个扫描器同时处理的条目数，1 表示串行处理
                </FieldDescription>
                <FieldContent>
                  <Input
                    v-model="parallelCountModel"
                    type="number"
                    inputmode="numeric"
                    :min="SCANNER_PARALLEL_COUNT_MIN"
                    :max="SCANNER_PARALLEL_COUNT_MAX"
                    step="1"
                    class="w-24"
                  />
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>忽略名称列表</FieldLabel>
                <FieldDescription>扫描器会跳过这些提取后的实体名称</FieldDescription>
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="formData.newIgnoredName"
                      placeholder="输入要忽略的名称..."
                      class="flex-1"
                      @keydown="handleKeyDown"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      :disabled="!formData.newIgnoredName.trim()"
                      @click="handleAddIgnoredName"
                    >
                      <Icon
                        icon="icon-[mdi--plus]"
                        class="size-4"
                      />
                      添加
                    </Button>
                  </div>

                  <div
                    v-if="formData.ignoredNames.length > 0"
                    class="flex flex-wrap gap-1.5 mt-1.5 max-h-32 overflow-auto pr-1"
                  >
                    <Badge
                      v-for="name in formData.ignoredNames"
                      :key="name"
                      variant="secondary"
                      class="gap-1 text-xs pr-0.5"
                      :title="name"
                    >
                      <span class="truncate max-w-[150px]">{{ name }}</span>
                      <Button
                        size="icon-xs"
                        variant="text"
                        type="button"
                        @click="handleRemoveIgnoredName(name)"
                      >
                        <Icon
                          icon="icon-[mdi--close]"
                          class="size-3"
                        />
                      </Button>
                    </Badge>
                  </div>

                  <p
                    v-else
                    class="text-xs text-muted-foreground mt-2"
                  >
                    暂无忽略名称
                  </p>
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving"
              @click="open = false"
            >
              取消
            </Button>
            <Button
              type="submit"
              :disabled="isSaving"
            >
              保存
            </Button>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * Scanner Form Dialog
 *
 * Dialog for creating or editing a scanner.
 * Uses watch(open) pattern to load/reset form data.
 */

import { ref, computed, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { Icon } from '@renderer/components/ui/icon'
import { useAsyncData, useRenderState } from '@renderer/composables'
import { scanners, settings, type Scanner, type NameExtractionRule } from '@shared/db'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { notify } from '@renderer/core/notify'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { StateView } from '@renderer/components/ui/state-view'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Field, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupText
} from '@renderer/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { CollectionSelect } from '@renderer/components/shared/collection'
import { ScraperProfileSelect } from '@renderer/components/shared/scraper'
import ScannerTestDialog from './scanner-item-test-dialog.vue'
import { ScannerNameExtractionRulesFormDialog } from './name-extraction-rules-form-dialog'

// =============================================================================
// Props & Model
// =============================================================================

interface Props {
  scannerId?: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

// =============================================================================
// Constants
// =============================================================================

// =============================================================================
// State
// =============================================================================

const isSaving = ref(false)
const scanner = ref<Scanner | null>(null)
const isTestDialogOpen = ref(false)
const isRulesDialogOpen = ref(false)

const typeOptions = [{ value: 'game', label: '游戏' }] as const
const entityDepthHelp = {
  text: '指定媒体实体在目录结构中的层级深度。0 表示扫描路径的直接子项就是实体，1 表示子目录下的项目是实体，以此类推。'
} as const
const scraperProfileHelp = {
  text: '选择用于获取元数据的刮削配置。配置决定了从哪些数据源获取哪些字段的数据。'
} as const
const scanIntervalDescription = '设置为 0 表示不自动扫描'
const nameExtractionRulesHelp = {
  text: '按顺序应用正则表达式规则，从文件夹名中提取游戏名称。规则使用命名捕获组 (?<name>...) 提取名称。',
  icon: 'icon-[mdi--regex]'
} as const
const nameExtractionRulesLink = {
  href: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Regular_expressions/Named_capturing_group',
  label: '查看命名捕获组文档'
} as const

// Form state
interface FormData {
  name: string
  path: string
  type: Scanner['type']
  scraperProfileId: string
  targetCollectionId: string | null
  scanIntervalMinutes: number
  entityDepth: number
  nameExtractionRules: NameExtractionRule[]
}

const formData = ref<FormData>({
  name: '',
  path: '',
  type: 'game',
  scraperProfileId: '',
  targetCollectionId: null,
  scanIntervalMinutes: 0,
  entityDepth: 0,
  nameExtractionRules: []
})

// =============================================================================
// Computed
// =============================================================================

const isEdit = computed(() => !!props.scannerId)

// =============================================================================
// Load Data on Open
// =============================================================================

const { data, isLoading, error } = useAsyncData(
  async () => {
    if (!props.scannerId) return null
    return await db.query.scanners.findFirst({
      where: eq(scanners.id, props.scannerId)
    })
  },
  {
    watch: [() => props.scannerId],
    enabled: () => open.value && !!props.scannerId
  }
)
const state = useRenderState(isLoading, error, isEdit.value ? data : true)

// Initialize form when data loads or dialog opens
watch(
  [data, open],
  ([d, isOpen]) => {
    if (!isOpen) return
    if (d) {
      scanner.value = d
      formData.value = {
        name: d.name,
        path: d.path,
        type: d.type,
        scraperProfileId: d.scraperProfileId,
        targetCollectionId: d.targetCollectionId,
        scanIntervalMinutes: d.scanIntervalMinutes,
        entityDepth: d.entityDepth,
        nameExtractionRules: d.nameExtractionRules ?? []
      }
    } else if (!props.scannerId) {
      // Create mode: reset form
      scanner.value = null
      formData.value = {
        name: '',
        path: '',
        type: 'game',
        scraperProfileId: '',
        targetCollectionId: null,
        scanIntervalMinutes: 0,
        entityDepth: 0,
        nameExtractionRules: []
      }
    }
  },
  { immediate: true }
)

// =============================================================================
// Handlers
// =============================================================================

async function handleSelectPath() {
  const result = await ipcManager.invoke('native:open-dialog', {
    properties: ['openDirectory']
  })

  if (result.success && result.data && !result.data.canceled && result.data.filePaths.length > 0) {
    formData.value.path = result.data.filePaths[0]
  }
}

async function handleSubmit() {
  if (
    !formData.value.name.trim() ||
    !formData.value.path.trim() ||
    !formData.value.scraperProfileId
  ) {
    notify.error('请填写必填字段')
    return
  }

  isSaving.value = true
  try {
    if (isEdit.value && scanner.value) {
      await db
        .update(scanners)
        .set({
          name: formData.value.name.trim(),
          path: formData.value.path.trim(),
          type: formData.value.type,
          scraperProfileId: formData.value.scraperProfileId,
          targetCollectionId: formData.value.targetCollectionId,
          scanIntervalMinutes: formData.value.scanIntervalMinutes,
          entityDepth: formData.value.entityDepth,
          nameExtractionRules: formData.value.nameExtractionRules
        })
        .where(eq(scanners.id, scanner.value.id))
      notify.success('扫描器已更新')
    } else {
      await db
        .insert(scanners)
        .values({
          name: formData.value.name.trim(),
          path: formData.value.path.trim(),
          type: formData.value.type,
          scraperProfileId: formData.value.scraperProfileId,
          targetCollectionId: formData.value.targetCollectionId,
          scanIntervalMinutes: formData.value.scanIntervalMinutes,
          entityDepth: formData.value.entityDepth,
          nameExtractionRules: formData.value.nameExtractionRules
        })
        .returning({ id: scanners.id })
      notify.success('扫描器已创建')
    }
    open.value = false
  } catch {
    notify.error(isEdit.value ? '更新失败，请重试' : '创建失败，请重试')
  } finally {
    isSaving.value = false
  }
}

function handleRulesSave(rules: NameExtractionRule[]) {
  formData.value.nameExtractionRules = rules
}

// Computed model for entity depth (parse string to number, clamp 0-5)
const entityDepthModel = computed({
  get: () => formData.value.entityDepth,
  set: (value: string | number | undefined) => {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
    formData.value.entityDepth = isNaN(num) ? 0 : Math.max(0, Math.min(5, num))
  }
})

// Computed model for scan interval (parse string to number, clamp >= 0)
const scanIntervalModel = computed({
  get: () => formData.value.scanIntervalMinutes,
  set: (value: string | number | undefined) => {
    const num = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10)
    formData.value.scanIntervalMinutes = isNaN(num) ? 0 : Math.max(0, num)
  }
})

async function handleAddToIgnoreList(ignoreName: string) {
  const currentSettings = await db.query.settings.findFirst()
  const currentIgnoredNames = currentSettings?.scannerIgnoredNames || []
  if (!currentIgnoredNames.includes(ignoreName)) {
    await db
      .update(settings)
      .set({ scannerIgnoredNames: [...currentIgnoredNames, ignoreName] })
      .where(eq(settings.id, 0))
  }
}

async function openLink(link: { href: string }): Promise<void> {
  try {
    unwrapIpcVoid(await ipcManager.invoke('native:open-external', link.href))
  } catch (error) {
    notify.error('打开链接失败', error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ isEdit ? '编辑扫描器' : '创建扫描器' }}</DialogTitle>
      </DialogHeader>

      <template v-if="state === 'loading'">
        <DialogBody>
          <StateView
            state="loading"
            class="py-8"
          />
        </DialogBody>
      </template>

      <template v-else>
        <Form @submit="handleSubmit">
          <DialogBody class="max-h-[60vh] overflow-auto">
            <FieldGroup>
              <Field label="名称">
                <FieldContent>
                  <Input
                    v-model="formData.name"
                    required
                    placeholder="例如: 我的游戏库"
                  />
                </FieldContent>
              </Field>

              <Field label="类型">
                <FieldContent>
                  <Select v-model="formData.type">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in typeOptions"
                        :key="option.value"
                        :value="option.value"
                      >
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field label="扫描路径">
                <FieldContent>
                  <div class="flex gap-2">
                    <Input
                      v-model="formData.path"
                      required
                      placeholder="选择要扫描的文件夹"
                      class="flex-1"
                    />
                    <Button
                      type="button"
                      variant="input"
                      size="icon"
                      @click="handleSelectPath"
                    >
                      <Icon
                        icon="icon-[mdi--folder-open-outline]"
                        class="size-4"
                      />
                    </Button>
                  </div>
                </FieldContent>
              </Field>

              <Field
                for="entityDepth"
                label="实体层级"
                :help="entityDepthHelp"
              >
                <FieldContent>
                  <Input
                    id="entityDepth"
                    v-model="entityDepthModel"
                    type="number"
                    :min="0"
                    :max="5"
                  />
                </FieldContent>
              </Field>

              <Field
                label="刮削配置"
                :help="scraperProfileHelp"
              >
                <FieldContent>
                  <ScraperProfileSelect
                    v-model="formData.scraperProfileId"
                    media-type="game"
                  />
                </FieldContent>
              </Field>

              <Field label="目标合集">
                <FieldContent>
                  <CollectionSelect
                    v-model="formData.targetCollectionId"
                    allow-create
                    class="w-full"
                  />
                </FieldContent>
              </Field>

              <Field
                for="interval"
                label="自动扫描间隔"
                :description="scanIntervalDescription"
              >
                <FieldContent>
                  <InputGroup>
                    <InputGroupInput
                      id="interval"
                      v-model="scanIntervalModel"
                      type="number"
                      :min="0"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>分钟</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                </FieldContent>
              </Field>

              <Field
                label="名称提取规则"
                :help="nameExtractionRulesHelp"
                :link="nameExtractionRulesLink"
                @link-click="openLink"
              >
                <FieldContent>
                  <Button
                    type="button"
                    variant="input"
                    class="w-full justify-start"
                    @click="isRulesDialogOpen = true"
                  >
                    <Icon
                      icon="icon-[mdi--regex]"
                      class="size-4 mr-2"
                    />
                    编辑规则
                    <span class="ml-auto text-muted-foreground">
                      {{
                        formData.nameExtractionRules.length === 0
                          ? '未配置'
                          : `${formData.nameExtractionRules.length} 条`
                      }}
                    </span>
                  </Button>
                </FieldContent>
              </Field>
            </FieldGroup>
          </DialogBody>

          <DialogFooter class="flex justify-between">
            <Button
              type="button"
              variant="outline"
              :disabled="isSaving || !formData.path"
              @click="isTestDialogOpen = true"
            >
              <Icon
                icon="icon-[mdi--flask-outline]"
                class="size-4 mr-1.5"
              />
              测试配置
            </Button>
            <div class="flex gap-2">
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
            </div>
          </DialogFooter>
        </Form>
      </template>
    </DialogContent>

    <ScannerTestDialog
      v-if="isTestDialogOpen"
      v-model:open="isTestDialogOpen"
      :scanner-path="formData.path"
      :entity-depth="formData.entityDepth"
      :rules="formData.nameExtractionRules"
      :on-add-to-ignore-list="handleAddToIgnoreList"
    />

    <ScannerNameExtractionRulesFormDialog
      v-if="isRulesDialogOpen"
      v-model:open="isRulesDialogOpen"
      :rules="formData.nameExtractionRules"
      @save="handleRulesSave"
    />
  </Dialog>
</template>

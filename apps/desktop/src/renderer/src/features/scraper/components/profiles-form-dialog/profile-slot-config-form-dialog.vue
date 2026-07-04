<!--
  ScraperSlotConfigFormDialog edits one slot's strategy, provider order, and fetch locales.
  Relation collections additionally expose the unmatched-entity policy.
-->
<script setup lang="ts">
import type {
  ScraperProviderEntry,
  ScraperSlot,
  SlotConfig,
  SlotStrategy,
  UnmatchedEntityPolicy
} from '@shared/db'
import type { ContentEntityType } from '@shared/common'

import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import {
  getDefaultUnmatchedEntityPolicy,
  getSupportedSlotStrategies,
  isRelationCollectionSlot,
  normalizeSlotStrategy
} from '@shared/scraper'
import {
  getScraperProviderDisplay,
  ScraperProviderSelect,
  type ScraperProviderDisplay,
  type ScraperProvidersByType
} from '@renderer/components/shared/scraper'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Button } from '@renderer/components/ui/button'
import { Switch } from '@renderer/components/ui/switch'
import { LocaleSelect } from '@renderer/components/ui/locale-select'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { cn } from '@renderer/utils'

interface Props {
  entityType: ContentEntityType
  slotType: ScraperSlot
  slotName: string
  slotConfig: SlotConfig
  providersByType: ScraperProvidersByType
  onSave: (config: SlotConfig) => void
}

interface StrategyOption {
  value: SlotStrategy
  label: string
  description: string
}

interface UnmatchedPolicyOption {
  value: UnmatchedEntityPolicy
  label: string
  description: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const STRATEGY_LABELS: Record<SlotStrategy, string> = {
  first: '首个',
  enrich: '增强'
}

const UNMATCHED_POLICY_LABELS: Record<UnmatchedEntityPolicy, string> = {
  ignore: '忽略未匹配项',
  append: '追加未匹配项'
}

interface SlotConfigFormData {
  strategy: SlotStrategy
  unmatchedEntityPolicy: UnmatchedEntityPolicy
  providers: ScraperProviderEntry[]
}

interface ProviderRow {
  entry: ScraperProviderEntry
  index: number
  display: ScraperProviderDisplay
}

function cloneProviderEntry(entry: ScraperProviderEntry): ScraperProviderEntry {
  return {
    providerId: entry.providerId,
    enabled: entry.enabled,
    priority: entry.priority,
    locale: entry.locale ?? undefined
  }
}

function createFormData(slot: ScraperSlot, config: SlotConfig): SlotConfigFormData {
  return {
    strategy: normalizeSlotStrategy(config.strategy),
    unmatchedEntityPolicy: getSlotUnmatchedEntityPolicy(slot, config),
    providers: config.providers.map(cloneProviderEntry)
  }
}

const formData = ref<SlotConfigFormData>({
  strategy: 'first',
  unmatchedEntityPolicy: getDefaultUnmatchedEntityPolicy(),
  providers: []
})

function getStrategyDescription(value: SlotStrategy): string {
  if (value === 'first') {
    return '使用第一个有效结果，忽略后续来源'
  }

  return '以首个结果为基准，补全缺失字段'
}

const strategyOptions = computed<StrategyOption[]>(() =>
  getSupportedSlotStrategies().map((value) => ({
    value,
    label: STRATEGY_LABELS[value],
    description: getStrategyDescription(value)
  }))
)

const unmatchedPolicyOptions: UnmatchedPolicyOption[] = [
  {
    value: 'ignore',
    label: UNMATCHED_POLICY_LABELS.ignore,
    description: '只补全已匹配实体，新的未匹配实体会被丢弃'
  },
  {
    value: 'append',
    label: UNMATCHED_POLICY_LABELS.append,
    description: '未匹配实体会被追加，并可继续被后续来源补全'
  }
]

function getSlotUnmatchedEntityPolicy(
  slot: ScraperSlot,
  config: SlotConfig
): UnmatchedEntityPolicy {
  if (!isRelationCollectionSlot(slot) || !('unmatchedEntityPolicy' in config)) {
    return getDefaultUnmatchedEntityPolicy()
  }

  return config.unmatchedEntityPolicy
}

function resetForm() {
  formData.value = createFormData(props.slotType, props.slotConfig)
}

watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen || !props.slotConfig) return

    resetForm()
  },
  { immediate: true }
)

const existingProviderIds = computed(() =>
  formData.value.providers.map((entry) => entry.providerId)
)

const availableProviders = computed(() => props.providersByType[props.entityType] ?? [])

const providerRows = computed<ProviderRow[]>(() =>
  formData.value.providers.map((entry, index) => ({
    entry,
    index,
    display: getScraperProviderDisplay(entry.providerId, availableProviders.value, [props.slotType])
  }))
)

function reindexProviders() {
  formData.value.providers.forEach((entry, priority) => {
    entry.priority = priority
  })
}

function handleAddProvider(providerId: string) {
  if (!providerId) return

  formData.value.providers.push({
    providerId,
    enabled: true,
    priority: formData.value.providers.length,
    locale: undefined
  })
}

function handleRemoveProvider(index: number) {
  formData.value.providers.splice(index, 1)
  reindexProviders()
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const entries = formData.value.providers
  ;[entries[index - 1], entries[index]] = [entries[index], entries[index - 1]]
  reindexProviders()
}

function handleMoveDown(index: number) {
  if (index >= formData.value.providers.length - 1) return
  const entries = formData.value.providers
  ;[entries[index], entries[index + 1]] = [entries[index + 1], entries[index]]
  reindexProviders()
}

function handleSubmit() {
  props.onSave(
    isRelationCollectionSlot(props.slotType)
      ? {
          strategy: formData.value.strategy,
          unmatchedEntityPolicy: formData.value.unmatchedEntityPolicy,
          providers: formData.value.providers.map(cloneProviderEntry)
        }
      : {
          strategy: formData.value.strategy,
          providers: formData.value.providers.map(cloneProviderEntry)
        }
  )

  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>配置: {{ props.slotName }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="max-h-[60vh] overflow-auto">
          <FieldGroup>
            <Field>
              <FieldLabel>策略</FieldLabel>
              <FieldDescription>多个提供者返回数据时的处理方式</FieldDescription>
              <FieldContent>
                <Select v-model="formData.strategy">
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="选择策略" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in strategyOptions"
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

            <Field v-if="isRelationCollectionSlot(props.slotType)">
              <FieldLabel>未匹配实体</FieldLabel>
              <FieldDescription>是否追加后续数据源的未匹配实体</FieldDescription>
              <FieldContent>
                <Select v-model="formData.unmatchedEntityPolicy">
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="选择未匹配实体策略" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in unmatchedPolicyOptions"
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

            <Field>
              <FieldLabel>数据提供者</FieldLabel>
              <FieldDescription>选择为此槽位提供数据的来源，可调整优先级</FieldDescription>
              <FieldContent>
                <div class="space-y-1.5">
                  <p
                    v-if="formData.providers.length === 0"
                    class="rounded-lg border bg-muted/30 py-4 text-center text-sm text-muted-foreground"
                  >
                    暂无提供者
                  </p>
                  <div
                    v-for="row in providerRows"
                    :key="row.entry.providerId"
                    :class="
                      cn(
                        'flex items-center gap-2 rounded-lg border bg-card p-2',
                        row.display.status !== 'available' && 'border-warning/30 bg-warning/10',
                        !row.entry.enabled && 'opacity-50'
                      )
                    "
                  >
                    <Switch
                      v-model="row.entry.enabled"
                      class="shrink-0"
                    />
                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 items-center gap-1.5">
                        <span class="truncate text-sm font-medium">{{ row.display.label }}</span>
                        <Badge
                          v-if="row.display.statusLabel"
                          variant="warning"
                          class="shrink-0 px-1 py-0 text-[10px]"
                        >
                          {{ row.display.statusLabel }}
                        </Badge>
                      </div>
                      <div
                        v-if="
                          row.display.description && row.display.description !== row.display.label
                        "
                        class="truncate text-xs text-muted-foreground"
                      >
                        {{ row.display.description }}
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <span class="text-xs text-muted-foreground">语言:</span>
                      <LocaleSelect
                        v-model="row.entry.locale"
                        class="w-20"
                        size="sm"
                        placeholder="默认"
                      />
                    </div>
                    <div class="flex shrink-0 items-center gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        :disabled="row.index === 0"
                        class="size-6"
                        @click="handleMoveUp(row.index)"
                      >
                        <Icon
                          icon="icon-[mdi--arrow-up]"
                          class="size-3.5"
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        :disabled="row.index === formData.providers.length - 1"
                        class="size-6"
                        @click="handleMoveDown(row.index)"
                      >
                        <Icon
                          icon="icon-[mdi--arrow-down]"
                          class="size-3.5"
                        />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        class="size-6 text-destructive hover:text-destructive"
                        @click="handleRemoveProvider(row.index)"
                      >
                        <Icon
                          icon="icon-[mdi--close]"
                          class="size-3.5"
                        />
                      </Button>
                    </div>
                  </div>
                  <ScraperProviderSelect
                    model-value=""
                    :entity-type="props.entityType"
                    :required-capabilities="[props.slotType]"
                    :exclude-provider-ids="existingProviderIds"
                    placeholder="添加提供者..."
                    size="sm"
                    :auto-select-first="false"
                    @change="handleAddProvider"
                  />
                </div>
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            取消
          </Button>
          <Button type="submit">保存</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>

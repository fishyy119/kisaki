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
import type { ContentEntityType } from '@shared/entity-types'

import { computed, ref, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { Badge } from '@renderer/components/ui/badge'
import { useI18n } from '@renderer/composables/use-i18n'
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
import { StateView } from '@renderer/components/ui/state-view'
import { Switch } from '@renderer/components/ui/switch'
import { ContentLocaleSelect } from '@renderer/components/ui/locale-select'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel
} from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import { cn } from '@renderer/utils/cn'

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

const { m } = useI18n()

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

const strategyOptions = computed<StrategyOption[]>(() =>
  getSupportedSlotStrategies().map((value) => ({
    value,
    label:
      value === 'first'
        ? m.value.scraper.profiles.strategyFirst
        : m.value.scraper.profiles.strategyEnrich,
    description:
      value === 'first'
        ? m.value.scraper.profiles.strategyFirstHint
        : m.value.scraper.profiles.strategyEnrichHint
  }))
)

const unmatchedPolicyOptions = computed<UnmatchedPolicyOption[]>(() => [
  {
    value: 'ignore',
    label: m.value.scraper.profiles.unmatchedIgnore,
    description: m.value.scraper.profiles.unmatchedIgnoreHint
  },
  {
    value: 'append',
    label: m.value.scraper.profiles.unmatchedAppend,
    description: m.value.scraper.profiles.unmatchedAppendHint
  }
])

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
  ;[entries[index - 1], entries[index]] = [entries[index]!, entries[index - 1]!]
  reindexProviders()
}

function handleMoveDown(index: number) {
  if (index >= formData.value.providers.length - 1) return
  const entries = formData.value.providers
  ;[entries[index], entries[index + 1]] = [entries[index + 1]!, entries[index]!]
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
        <DialogTitle>{{
          m.scraper.profiles.slotDialogTitle({ name: props.slotName })
        }}</DialogTitle>
      </DialogHeader>
      <Form @submit="handleSubmit">
        <DialogBody class="max-h-[60vh]">
          <FieldGroup>
            <Field>
              <FieldLabel>{{ m.scraper.profiles.strategyLabel }}</FieldLabel>
              <FieldDescription>{{ m.scraper.profiles.strategyHint }}</FieldDescription>
              <FieldContent>
                <Select v-model="formData.strategy">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="m.scraper.profiles.selectStrategy" />
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
              <FieldLabel>{{ m.scraper.profiles.unmatchedLabel }}</FieldLabel>
              <FieldDescription>{{ m.scraper.profiles.unmatchedHint }}</FieldDescription>
              <FieldContent>
                <Select v-model="formData.unmatchedEntityPolicy">
                  <SelectTrigger class="w-full">
                    <SelectValue :placeholder="m.scraper.profiles.selectUnmatched" />
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
              <FieldLabel>{{ m.scraper.profiles.providersLabel }}</FieldLabel>
              <FieldDescription>{{ m.scraper.profiles.providersHint }}</FieldDescription>
              <FieldContent>
                <div class="space-y-1.5">
                  <StateView
                    v-if="formData.providers.length === 0"
                    state="empty"
                    :description="m.scraper.profiles.noProviders"
                    class="rounded-lg border bg-muted/30 py-4"
                  />
                  <div
                    v-for="row in providerRows"
                    :key="row.entry.providerId"
                    :class="
                      cn(
                        'flex items-center gap-2 rounded-lg border p-2',
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
                          class="shrink-0 px-1 py-0"
                        >
                          {{ row.display.statusLabel }}
                        </Badge>
                      </div>
                      <!-- The raw provider id carries the extension namespace, so
                           same-named providers from different extensions stay apart. -->
                      <div class="truncate font-mono text-xs text-muted-foreground">
                        {{ row.display.id }}
                      </div>
                    </div>
                    <div class="flex shrink-0 items-center gap-1.5">
                      <span class="text-xs text-muted-foreground">{{
                        m.scraper.profiles.languageLabel
                      }}</span>
                      <ContentLocaleSelect
                        v-model="row.entry.locale"
                        class="w-20"
                        size="sm"
                        :placeholder="m.scraper.profiles.languageDefaultPlaceholder"
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
                    :placeholder="m.scraper.profiles.addProviderPlaceholder"
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
            {{ m.actions.cancel }}
          </Button>
          <Button type="submit">{{ m.actions.save }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>
</template>

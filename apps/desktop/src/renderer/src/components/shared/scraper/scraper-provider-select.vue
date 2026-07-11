<!--
  ScraperProviderSelect
  Select component for choosing a scraper provider.
  Supports filtering by capabilities.
-->
<script setup lang="ts">
import { computed, watch } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { useAsyncData, useRenderState } from '@renderer/composables'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/utils/cn'
import { cva } from 'class-variance-authority'
import type { ScraperCapability } from '@shared/scraper'
import type { ContentEntityType } from '@shared/common'
import { getScraperProviderDisplay, type ScraperProviderInfo } from './provider-display'

interface Props {
  /** Which entity type this provider list is for (default: game) */
  entityType?: ContentEntityType
  /** Filter by required capabilities */
  requiredCapabilities?: ScraperCapability[]
  /** Exclude these provider IDs from the list */
  excludeProviderIds?: string[]
  placeholder?: string
  disabled?: boolean
  class?: string
  /** Size variant - sm for compact display */
  size?: 'default' | 'sm'
  /** Auto focus the select when mounted */
  autoFocus?: boolean
  /** Auto-select first filtered provider when value is empty (default: true) */
  autoSelectFirst?: boolean
  /** Keep the current value visible even if its provider is not currently available */
  showUnavailableSelected?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  entityType: 'game',
  requiredCapabilities: () => [],
  excludeProviderIds: () => [],
  placeholder: '选择提供者...',
  disabled: false,
  size: 'default',
  autoFocus: false,
  autoSelectFirst: true,
  showUnavailableSelected: true
})

const model = defineModel<string>()

const emit = defineEmits<{
  change: [providerId: string]
}>()

async function listProviders(entityType: ContentEntityType): Promise<ScraperProviderInfo[]> {
  switch (entityType) {
    case 'game': {
      const result = await ipcManager.invoke('scraper:list-game-providers')
      return result.success ? result.data : []
    }
    case 'person': {
      const result = await ipcManager.invoke('scraper:list-person-providers')
      return result.success ? result.data : []
    }
    case 'company': {
      const result = await ipcManager.invoke('scraper:list-company-providers')
      return result.success ? result.data : []
    }
    case 'character': {
      const result = await ipcManager.invoke('scraper:list-character-providers')
      return result.success ? result.data : []
    }
  }
}

// Fetch providers via IPC
const {
  data: providers,
  isLoading,
  error
} = useAsyncData(() => listProviders(props.entityType), { watch: [() => props.entityType] })
const state = useRenderState(isLoading, error, providers)

// Filter providers by required capabilities and exclude list
const filteredProviders = computed(() => {
  const list = providers.value ?? []
  let result = props.requiredCapabilities.length
    ? list.filter((p) => props.requiredCapabilities.every((cap) => p.capabilities.includes(cap)))
    : list

  if (props.excludeProviderIds.length) {
    result = result.filter((p) => !props.excludeProviderIds.includes(p.id))
  }

  return result
})

const selectedFallbackProvider = computed(() => {
  if (!props.showUnavailableSelected || !model.value) {
    return null
  }

  if (filteredProviders.value.some((provider) => provider.id === model.value)) {
    return null
  }

  return getScraperProviderDisplay(model.value, providers.value ?? [], props.requiredCapabilities)
})

const selectedProviderLabel = computed(() => {
  if (!model.value) {
    return null
  }

  const selectedProvider = filteredProviders.value.find((provider) => provider.id === model.value)
  if (selectedProvider) {
    return selectedProvider.name
  }

  return selectedFallbackProvider.value?.label ?? null
})

const triggerVariants = cva('w-full', {
  variants: {
    size: {
      default: '',
      sm: 'h-7 text-xs'
    }
  },
  defaultVariants: { size: 'default' }
})

// Auto-select first provider when value is empty and loading is complete
watch(
  [isLoading, filteredProviders, model],
  () => {
    if (
      props.autoSelectFirst &&
      !isLoading.value &&
      !model.value &&
      filteredProviders.value.length > 0
    ) {
      const firstProvider = filteredProviders.value[0]
      model.value = firstProvider.id
      emit('change', firstProvider.id)
    }
  },
  { immediate: true }
)

// Watch model changes to emit change event
watch(model, (providerId) => {
  if (providerId) {
    emit('change', providerId)
  }
})
</script>

<template>
  <!-- Loading state -->
  <div
    v-if="state === 'loading'"
    :class="cn('flex items-center gap-2 h-7', props.class)"
  >
    <span class="text-xs text-muted-foreground">加载中...</span>
  </div>

  <!-- Normal select -->
  <Select
    v-else
    v-model="model"
    :disabled="disabled"
  >
    <SelectTrigger
      :class="cn(triggerVariants({ size: props.size }), props.class)"
      :auto-focus="autoFocus"
    >
      <SelectValue
        v-if="selectedProviderLabel"
        :placeholder="placeholder"
      >
        {{ selectedProviderLabel }}
      </SelectValue>
      <SelectValue
        v-else
        :placeholder="placeholder"
      />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-if="selectedFallbackProvider"
        :value="selectedFallbackProvider.id"
        disabled
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <span class="truncate">{{ selectedFallbackProvider.label }}</span>
          <Badge
            v-if="selectedFallbackProvider.statusLabel"
            variant="warning"
            class="shrink-0 px-1 py-0 text-[10px]"
          >
            {{ selectedFallbackProvider.statusLabel }}
          </Badge>
        </div>
      </SelectItem>
      <div
        v-if="filteredProviders.length === 0 && !selectedFallbackProvider"
        class="py-2 px-2 text-xs text-muted-foreground"
      >
        暂无可用提供者
      </div>
      <SelectItem
        v-for="provider in filteredProviders"
        :key="provider.id"
        :value="provider.id"
      >
        <div class="flex items-center gap-2">
          <span>{{ provider.name }}</span>
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
</template>

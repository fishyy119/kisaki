<!--
  ScraperNewProfileDialog
  Dialog for selecting media type and provider when creating a new profile.
  Step 1: Select media type
  Step 2: Select provider
-->
<script setup lang="ts">
import type { ContentEntityType } from '@shared/common'
import type {
  ScraperProviderInfo,
  ScraperProvidersByType
} from '@renderer/components/shared/scraper'

import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { useI18n } from '@renderer/composables/use-i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { getEntityIcon } from '@renderer/utils/format'

interface Props {
  providersByType: ScraperProvidersByType
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  select: [mediaType: ContentEntityType, providerId: string]
}>()

const { m } = useI18n()

const selectedMediaType = ref<ContentEntityType | null>(null)

// Media type options
const mediaTypeOptions = computed<{ value: ContentEntityType; label: string }[]>(() => [
  { value: 'game', label: m.value.library.entities.game },
  { value: 'anime', label: m.value.library.entities.anime },
  { value: 'character', label: m.value.library.entities.character },
  { value: 'person', label: m.value.library.entities.person },
  { value: 'company', label: m.value.library.entities.company }
])

const currentProviders = computed<ScraperProviderInfo[]>(() => {
  if (!selectedMediaType.value) return []
  return props.providersByType[selectedMediaType.value] ?? []
})

// Filter providers that support search capability
const searchProviders = computed(() =>
  currentProviders.value.filter((p) => p.capabilities.includes('search'))
)

// Reset state when dialog closes
watch(
  () => open.value,
  (isOpen) => {
    if (!isOpen) {
      selectedMediaType.value = null
    }
  }
)

function handleMediaTypeSelected(mediaType: ContentEntityType) {
  selectedMediaType.value = mediaType
}

function handleProviderSelected(providerId: string) {
  if (!selectedMediaType.value) return
  emit('select', selectedMediaType.value, providerId)
  open.value = false
}

function handleBackToMediaType() {
  selectedMediaType.value = null
}

function handleClose() {
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{
          selectedMediaType
            ? m.scraper.profiles.newTitleProvider
            : m.scraper.profiles.newTitleMediaType
        }}</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <!-- Media Type Selection -->
        <template v-if="!selectedMediaType">
          <p class="text-sm text-muted-foreground mb-4">
            {{ m.scraper.profiles.newMediaTypeHint }}
          </p>
          <div class="space-y-1">
            <button
              v-for="option in mediaTypeOptions"
              :key="option.value"
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
              @click="() => handleMediaTypeSelected(option.value)"
            >
              <div class="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Icon
                  :icon="getEntityIcon(option.value)"
                  class="size-5 text-muted-foreground"
                />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium">{{ option.label }}</div>
              </div>
            </button>
          </div>
        </template>

        <!-- Provider Selection -->
        <template v-else>
          <p class="text-sm text-muted-foreground mb-4">
            {{ m.scraper.profiles.newProviderHint }}
          </p>
          <div class="space-y-1">
            <button
              v-for="provider in searchProviders"
              :key="provider.id"
              type="button"
              class="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
              @click="() => handleProviderSelected(provider.id)"
            >
              <div class="size-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                <Icon
                  icon="icon-[mdi--database-outline]"
                  class="size-5 text-muted-foreground"
                />
              </div>
              <div class="min-w-0">
                <div class="text-sm font-medium">{{ provider.name }}</div>
                <div class="text-xs text-muted-foreground font-mono">{{ provider.id }}</div>
              </div>
            </button>
            <p
              v-if="searchProviders.length === 0"
              class="text-sm text-muted-foreground text-center py-4"
            >
              {{ m.scraper.profiles.noProvidersAvailable }}
            </p>
          </div>
        </template>
      </DialogBody>
      <DialogFooter class="flex justify-between">
        <Button
          v-if="selectedMediaType"
          variant="outline"
          @click="handleBackToMediaType"
        >
          <Icon
            icon="icon-[mdi--arrow-left]"
            class="size-4 mr-1"
          />
          {{ m.common.back }}
        </Button>
        <div class="flex-1" />
        <Button
          variant="outline"
          @click="handleClose"
        >
          {{ m.common.cancel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

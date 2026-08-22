<!--
  AssetSearchFormDialog
  Dialog for searching an entity's image assets from scraper providers and
  importing the picked result into the current slot.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Icon } from '@renderer/components/ui/icon'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables'
import { cn } from '@renderer/utils/cn'
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
import { Spinner } from '@renderer/components/ui/spinner'
import { ScraperProviderSelect } from '@renderer/components/shared/scraper'
import { useI18n } from '@renderer/composables/use-i18n'
import type { ContentEntityType } from '@shared/common'
import { ENTITY_ASSET_SPECS } from './asset-specs'

const { m } = useI18n()

interface Props {
  entityType: ContentEntityType
  entityId: string
  slotType: string
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const spec = computed(() => ENTITY_ASSET_SPECS[props.entityType])
const slot = computed(() => spec.value.slots.find((s) => s.type === props.slotType)!)

// Selection state
const selectedUrl = ref<string | null>(null)
const selectedProviderId = ref('')
const isImporting = ref(false)

// Search state
const searchQuery = ref('')
const images = ref<string[]>([])
const isLoadingImages = ref(false)
const imagesError = ref<Error | null>(null)
const hasSearched = ref(false)

// Fetch entry names when dialog opens
const { data: entry, isLoading } = useAsyncData(() => spec.value.loadEntry(props.entityId), {
  watch: [() => props.entityId],
  enabled: () => open.value
})

// Initialize search query when data loads
watch(entry, (data) => {
  if (data) {
    searchQuery.value = data.originalName ?? data.name
  }
})

async function handleSearch() {
  if (!selectedProviderId.value || !entry.value) return

  isLoadingImages.value = true
  imagesError.value = null
  hasSearched.value = true
  selectedUrl.value = null

  try {
    const result = await spec.value.searchImages(
      selectedProviderId.value,
      {
        entityId: props.entityId,
        name: searchQuery.value.trim() || entry.value.originalName || entry.value.name
      },
      slot.value.searchCapability
    )
    if (result.success && result.data) {
      images.value = result.data
    } else {
      imagesError.value = new Error(result.error)
    }
  } catch (error) {
    imagesError.value = error as Error
  } finally {
    isLoadingImages.value = false
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    handleSearch()
  }
}

async function handleConfirm() {
  if (!selectedUrl.value) return

  isImporting.value = true
  try {
    await spec.value.setFile(props.entityId, props.slotType, {
      kind: 'url',
      url: selectedUrl.value
    })

    notify.success(m.value.library.forms.mediaUpdated)
    open.value = false
  } finally {
    isImporting.value = false
  }
}

function handleClose() {
  open.value = false
}

// Watch provider change to reset search state
watch(selectedProviderId, () => {
  hasSearched.value = false
  images.value = []
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-3xl">
      <DialogHeader>
        <DialogTitle>{{ m.library.forms.searchMediaTitle({ label: slot.label(m) }) }}</DialogTitle>
      </DialogHeader>

      <!-- Loading state -->
      <template v-if="isLoading || !entry">
        <DialogBody>
          <div class="flex items-center justify-center py-8">
            <Spinner class="size-8" />
          </div>
        </DialogBody>
      </template>

      <!-- Content -->
      <template v-else>
        <DialogBody class="flex flex-col gap-4">
          <!-- Search controls row -->
          <div class="flex items-center gap-3">
            <ScraperProviderSelect
              v-model="selectedProviderId"
              :entity-type="props.entityType"
              :required-capabilities="[slot.searchCapability]"
              class="w-[140px]"
            />

            <Input
              v-model="searchQuery"
              :placeholder="m.library.forms.searchKeywordPlaceholder"
              class="flex-1"
              :disabled="isLoadingImages"
              @keydown="handleKeyDown"
            />

            <Button
              type="button"
              :disabled="!selectedProviderId || isLoadingImages"
              @click="handleSearch"
            >
              <Icon
                v-if="isLoadingImages"
                icon="icon-[mdi--loading]"
                class="size-4 animate-spin"
              />
              <Icon
                v-else
                icon="icon-[mdi--magnify]"
                class="size-4"
              />
              {{ m.common.search }}
            </Button>
          </div>

          <!-- Image grid -->
          <div class="overflow-auto max-h-[60vh]">
            <div
              v-if="!hasSearched"
              class="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
            >
              <Icon
                icon="icon-[mdi--image-plus-outline]"
                class="size-10"
              />
              <p class="text-sm">{{ m.library.forms.searchStartHint }}</p>
            </div>
            <div
              v-else-if="isLoadingImages"
              class="flex items-center justify-center py-8"
            >
              <Spinner class="size-8" />
            </div>
            <div
              v-else-if="imagesError"
              class="flex flex-col items-center justify-center gap-2 py-12 text-destructive"
            >
              <Icon
                icon="icon-[mdi--alert-circle-outline]"
                class="size-10"
              />
              <p class="text-sm">{{ m.library.forms.searchFailedHint }}</p>
              <p class="text-xs text-muted-foreground">{{ imagesError.message }}</p>
            </div>
            <div
              v-else-if="images.length === 0"
              class="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground"
            >
              <Icon
                icon="icon-[mdi--image-off-outline]"
                class="size-10"
              />
              <p class="text-sm">{{ m.library.forms.searchNoImages }}</p>
            </div>
            <div
              v-else
              :class="cn('grid gap-3', slot.searchGridClass)"
            >
              <button
                v-for="(url, index) in images"
                :key="index"
                type="button"
                :class="
                  cn(
                    'relative overflow-hidden transition-colors border shadow-raised rounded-lg',
                    'hover:border-primary',
                    selectedUrl === url ? 'border-primary hover:border-primary' : 'border-border'
                  )
                "
                @click="selectedUrl = url"
              >
                <div :class="cn('w-full bg-muted', slot.aspectClass)">
                  <img
                    :src="url"
                    :alt="`Option ${index + 1}`"
                    class="size-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div
                  v-if="selectedUrl === url"
                  class="absolute inset-0 bg-primary/30 flex items-center justify-center"
                >
                  <Icon
                    icon="icon-[mdi--check-circle-outline]"
                    class="size-8 text-primary"
                  />
                </div>
              </button>
            </div>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            @click="handleClose"
          >
            {{ m.common.cancel }}
          </Button>
          <Button
            :disabled="!selectedUrl || isImporting"
            @click="handleConfirm"
          >
            <template v-if="isImporting">
              <Icon
                icon="icon-[mdi--loading]"
                class="size-4 animate-spin"
              />
              {{ m.library.forms.importing }}
            </template>
            <template v-else>{{ m.library.forms.confirmSelection }}</template>
          </Button>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>

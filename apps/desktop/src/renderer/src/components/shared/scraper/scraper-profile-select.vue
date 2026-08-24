<!--
  ScraperProfileSelect
  Select component for choosing a scraper profile.
  Shows media type badge in dropdown items.
  Includes embedded preset dialog for quick profile creation when empty.
-->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import { db } from '@renderer/core/db'
import { useAsyncData, useDbChanges, useI18n, useRenderState } from '@renderer/composables'
import { scraperProfiles, type ScraperProfile } from '@shared/db'
import type { ContentEntityType } from '@shared/common'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Spinner } from '@renderer/components/ui/spinner'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/utils/cn'
import { ScraperPresetFormDialog } from './forms'

interface Props {
  /** Filter by media type */
  mediaType?: ContentEntityType
  placeholder?: string
  disabled?: boolean
  class?: string
  /** Whether to show media type badge in items */
  showMediaType?: boolean
  /** Auto-select first profile when value is empty (default: true) */
  autoSelectFirst?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mediaType: 'game',
  placeholder: undefined,
  disabled: false,
  showMediaType: false,
  autoSelectFirst: true
})

const model = defineModel<string>()
const { m } = useI18n()

const placeholderText = computed(
  () => props.placeholder ?? m.value.scraper.profileSelect.placeholder
)

const emit = defineEmits<{
  change: [profileId: string]
}>()

const isPresetDialogOpen = ref(false)

const {
  data: profiles,
  isLoading,
  error,
  refetch
} = useAsyncData(
  () =>
    db
      .select()
      .from(scraperProfiles)
      .where(eq(scraperProfiles.mediaType, props.mediaType))
      .orderBy(scraperProfiles.order),
  { watch: [() => props.mediaType] }
)
const state = useRenderState(isLoading, error, profiles)

// Listen for profile changes
useDbChanges((payload) => {
  if (payload.table === 'scraper_profiles') refetch()
})

// Auto-select first profile when value is empty and loading is complete
watch(
  [() => isLoading.value, () => profiles.value, () => model.value],
  () => {
    if (
      props.autoSelectFirst &&
      !isLoading.value &&
      !model.value &&
      (profiles.value?.length ?? 0) > 0
    ) {
      const firstProfile = profiles.value![0]
      model.value = firstProfile.id
      emit('change', firstProfile.id)
    }
  },
  { immediate: true }
)

async function handleAddPresets(newProfiles: ScraperProfile[]) {
  // Get current max order
  const currentProfiles = profiles.value ?? []
  const maxOrder =
    currentProfiles.length > 0 ? Math.max(...currentProfiles.map((p) => p.order)) : -1

  // Save to DB directly
  for (let i = 0; i < newProfiles.length; i++) {
    const profile = newProfiles[i]
    await db.insert(scraperProfiles).values({
      ...profile,
      order: maxOrder + 1 + i
    })
  }

  // Auto-select the first added profile if no value is set
  if (!model.value && newProfiles.length > 0) {
    model.value = newProfiles[0].id
    emit('change', newProfiles[0].id)
  }
}

// Watch model changes to emit change event
watch(model, (profileId) => {
  if (profileId) {
    emit('change', profileId)
  }
})

// Expose for later use
void handleAddPresets
</script>

<template>
  <!-- Loading state -->
  <div
    v-if="state === 'loading'"
    :class="cn('flex items-center gap-2 h-7', props.class)"
  >
    <Spinner class="size-4" />
    <span class="text-xs text-muted-foreground">{{ m.common.loading }}</span>
  </div>

  <!-- Empty state with create button -->
  <div
    v-else-if="!profiles || profiles.length === 0"
    :class="cn('flex items-center gap-2', props.class)"
  >
    <Select disabled>
      <SelectTrigger class="w-full">
        <SelectValue :placeholder="m.scraper.profileSelect.empty" />
      </SelectTrigger>
    </Select>
    <Button
      type="button"
      variant="outline"
      size="icon"
      class="shrink-0"
      @click="isPresetDialogOpen = true"
    >
      <Icon
        icon="icon-[mdi--plus]"
        class="size-4"
      />
    </Button>
    <ScraperPresetFormDialog
      v-if="isPresetDialogOpen"
      v-model:open="isPresetDialogOpen"
      :media-type="props.mediaType"
      :on-add="handleAddPresets"
    />
  </div>

  <!-- Normal select -->
  <Select
    v-else
    v-model="model"
    :disabled="disabled"
  >
    <SelectTrigger :class="cn('w-full', props.class)">
      <SelectValue :placeholder="placeholderText" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-for="profile in profiles"
        :key="profile.id"
        :value="profile.id"
      >
        <div class="flex items-center gap-2">
          <span>{{ profile.name }}</span>
          <Badge
            v-if="showMediaType"
            variant="outline"
            class="px-1 py-0"
          >
            {{ m.library.entities[profile.mediaType] || profile.mediaType }}
          </Badge>
        </div>
      </SelectItem>
    </SelectContent>
  </Select>
</template>

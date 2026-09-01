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
import ScraperNewProfileDialog from './new-profile-dialog.vue'

/** Sentinel item value for the explicit "no profile" choice. */
const NONE_VALUE = '#none'

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
  /** Offer an explicit "no profile" item; an empty model means none. */
  allowNone?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mediaType: 'game',
  placeholder: undefined,
  disabled: false,
  showMediaType: false,
  autoSelectFirst: true,
  allowNone: false
})

const model = defineModel<string>()
const { m } = useI18n()

const placeholderText = computed(
  () => props.placeholder ?? m.value.scraper.profileSelect.placeholder
)

// The select needs a non-empty item value, so "none" travels as a sentinel
// and the public model keeps '' for it.
const selectModel = computed({
  get: () => (props.allowNone && !model.value ? NONE_VALUE : model.value),
  set: (value) => {
    model.value = value === NONE_VALUE ? '' : (value ?? '')
  }
})

const emit = defineEmits<{
  change: [profileId: string]
}>()

const isCreateDialogOpen = ref(false)

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
useDbChanges(({ tables }) => {
  if (tables.has('scraper_profiles')) refetch()
})

// Auto-select first profile when value is empty and loading is complete.
// With allowNone the empty value is a deliberate choice, so it stays.
watch(
  [() => isLoading.value, () => profiles.value, () => model.value],
  () => {
    if (
      props.autoSelectFirst &&
      !props.allowNone &&
      !isLoading.value &&
      !model.value &&
      (profiles.value?.length ?? 0) > 0
    ) {
      const firstProfile = profiles.value![0]!
      model.value = firstProfile.id
      emit('change', firstProfile.id)
    }
  },
  { immediate: true }
)

/** Quick creation writes straight to the store and selects the new profile. */
async function handleProfileCreated(profile: ScraperProfile) {
  const currentProfiles = profiles.value ?? []
  const maxOrder =
    currentProfiles.length > 0 ? Math.max(...currentProfiles.map((p) => p.order)) : -1

  await db.insert(scraperProfiles).values({
    ...profile,
    order: maxOrder + 1
  })

  if (!model.value) {
    model.value = profile.id
    emit('change', profile.id)
  }
}

// Watch model changes to emit change event
watch(model, (profileId) => {
  if (profileId) {
    emit('change', profileId)
  }
})
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
      @click="isCreateDialogOpen = true"
    >
      <Icon
        icon="icon-[mdi--plus]"
        class="size-4"
      />
    </Button>
    <ScraperNewProfileDialog
      v-if="isCreateDialogOpen"
      v-model:open="isCreateDialogOpen"
      mode="recipes"
      :media-type="props.mediaType"
      @create="handleProfileCreated"
    />
  </div>

  <!-- Normal select -->
  <Select
    v-else
    v-model="selectModel"
    :disabled="disabled"
  >
    <SelectTrigger :class="cn('w-full', props.class)">
      <SelectValue :placeholder="placeholderText" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem
        v-if="props.allowNone"
        :value="NONE_VALUE"
      >
        <span class="text-muted-foreground">{{ m.scraper.profileSelect.none }}</span>
      </SelectItem>
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

<!--
  CollectionDynamicConfigFormDialog

  Dialog for configuring dynamic collection filters.
  All content entity types are always shown with filter/sort controls visible.
  Checkbox toggles whether the type is included in the collection.
-->
<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { eq } from 'drizzle-orm'
import { Icon } from '@renderer/components/ui/icon'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { FilterDialog, getFilterUiSpec } from '@renderer/components/shared/filter'
import { useAsyncData } from '@renderer/composables'
import { cn } from '@renderer/utils/cn'
import { getEntityIcon } from '@renderer/utils/format'
import { notify } from '@renderer/core/notify'
import { db } from '@renderer/core/db'
import { createEmptyFilter, countConditions } from '@shared/filter'
import type { FilterState } from '@shared/filter'
import { collections, type DynamicCollectionConfig, type DynamicEntityConfig } from '@shared/db'
import { parseDynamicCollectionConfig } from '@shared/db/columns/json/collection'
import type { ContentEntityType, SortDirection } from '@shared/common'
import { CONTENT_ENTITY_TYPES } from '@shared/common'
import { createLogger } from '@renderer/core/log'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

const log = createLogger('Collection')

interface Props {
  collectionId: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  updated: [config: DynamicCollectionConfig]
}>()

interface EntityTypeConfig {
  label: string
}

const ENTITY_TYPE_CONFIG = computed<Record<ContentEntityType, EntityTypeConfig>>(() => ({
  game: { label: m.value.library.entities.game },
  anime: { label: m.value.library.entities.anime },
  character: { label: m.value.library.entities.character },
  person: { label: m.value.library.entities.person },
  company: { label: m.value.library.entities.company }
}))

function createDefaultEntityConfig(): DynamicEntityConfig {
  return {
    enabled: false,
    filter: createEmptyFilter(),
    sortField: 'name',
    sortDirection: 'asc'
  }
}

function createDefaultConfig(): DynamicCollectionConfig {
  return Object.fromEntries(
    CONTENT_ENTITY_TYPES.map((type) => [type, createDefaultEntityConfig()])
  ) as DynamicCollectionConfig
}

// Local config state
const localConfig = ref<DynamicCollectionConfig>(createDefaultConfig())
const initialized = ref(false)
const isSubmitting = ref(false)

const { data: existingCollection, refetch } = useAsyncData(
  async () => {
    const data = await db.query.collections.findFirst({
      where: eq(collections.id, props.collectionId)
    })
    return data ?? null
  },
  {
    watch: [() => props.collectionId],
    enabled: () => open.value
  }
)

// Filter dialog state
const filterDialogEntityType = ref<ContentEntityType | null>(null)
const filterDialogOpen = computed({
  get: () => filterDialogEntityType.value !== null,
  set: (value) => {
    if (!value) filterDialogEntityType.value = null
  }
})

const filterDialogUiSpec = computed(() =>
  filterDialogEntityType.value ? getFilterUiSpec(filterDialogEntityType.value).value : null
)

// Computed for current entity filter (for FilterDialog v-model)
const currentEntityFilter = computed({
  get: () =>
    filterDialogEntityType.value
      ? localConfig.value[filterDialogEntityType.value].filter
      : createEmptyFilter(),
  set: (filter: FilterState) => {
    if (filterDialogEntityType.value) {
      updateEntityConfig(filterDialogEntityType.value, { filter })
    }
  }
})

function getSortOptions(type: ContentEntityType) {
  return getFilterUiSpec(type).value.sortOptions
}

// Initialize config when dialog opens
watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      initialized.value = false
      refetch()
    }
  },
  { immediate: true }
)

watch(existingCollection, (data) => {
  if (!open.value) return
  if (initialized.value) return
  localConfig.value = data?.dynamicConfig ?? createDefaultConfig()
  initialized.value = true
})

function toggleEntity(type: ContentEntityType) {
  localConfig.value = {
    ...localConfig.value,
    [type]: { ...localConfig.value[type], enabled: !localConfig.value[type].enabled }
  }
}

// Helper to create checked model for entity enabled state
function createEntityEnabledModel(type: ContentEntityType) {
  return computed({
    get: () => localConfig.value[type].enabled,
    set: () => toggleEntity(type)
  })
}

/** Builds one model per entity type so the template can index them directly. */
function createModelsByEntityType<T>(
  create: (type: ContentEntityType) => T
): Record<ContentEntityType, T> {
  return Object.fromEntries(CONTENT_ENTITY_TYPES.map((type) => [type, create(type)])) as Record<
    ContentEntityType,
    T
  >
}

const entityEnabledModels = createModelsByEntityType(createEntityEnabledModel)

function updateEntityConfig(type: ContentEntityType, updates: Partial<DynamicEntityConfig>) {
  localConfig.value = {
    ...localConfig.value,
    [type]: { ...localConfig.value[type], ...updates }
  }
}

function openFilterDialog(type: ContentEntityType) {
  filterDialogEntityType.value = type
}

function handleConfirm() {
  void (async () => {
    if (isSubmitting.value) return
    isSubmitting.value = true
    try {
      // Storage accepts canonical configs only; unfinished conditions are dropped here.
      const config = parseDynamicCollectionConfig(localConfig.value) ?? createDefaultConfig()
      await db
        .update(collections)
        .set({ dynamicConfig: config })
        .where(eq(collections.id, props.collectionId))
      notify.success(m.value.library.forms.filterConfigUpdated)
      emit('updated', config)
      open.value = false
    } catch (error) {
      log.error('Failed to update filter config:', error)
      notify.error(m.value.library.feedback.updateFailed)
    } finally {
      isSubmitting.value = false
    }
  })()
}

const enabledCount = computed(
  () => CONTENT_ENTITY_TYPES.filter((t) => localConfig.value[t].enabled).length
)

// Helper to create computed models for each entity type's sort field and direction
function createSortFieldModel(type: ContentEntityType) {
  return computed({
    get: () => localConfig.value[type].sortField,
    set: (v: string) => updateEntityConfig(type, { sortField: v })
  })
}

function createSortDirectionModel(type: ContentEntityType) {
  return computed({
    get: () => localConfig.value[type].sortDirection,
    set: (v: string) => updateEntityConfig(type, { sortDirection: v as SortDirection })
  })
}

const sortFieldModels = createModelsByEntityType(createSortFieldModel)
const sortDirectionModels = createModelsByEntityType(createSortDirectionModel)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            icon="icon-[mdi--filter-outline]"
            class="size-5"
          />
          {{ m.library.forms.dynamicConfigTitle }}
          <span
            v-if="enabledCount > 0"
            class="text-sm font-normal text-muted-foreground"
          >
            {{ m.library.forms.enabledTypesCount({ count: enabledCount }) }}
          </span>
        </DialogTitle>
      </DialogHeader>

      <DialogBody class="overflow-auto max-h-[60vh]">
        <div class="space-y-2">
          <div
            v-for="type in CONTENT_ENTITY_TYPES"
            :key="type"
            :class="
              cn(
                'rounded-lg border p-3 transition-colors',
                localConfig[type].enabled ? 'border-primary/30' : 'border-border'
              )
            "
          >
            <!-- Header row with checkbox and entity info -->
            <div class="flex items-center gap-3">
              <Checkbox
                v-model="entityEnabledModels[type].value"
                class="shrink-0"
              />
              <div
                :class="
                  cn(
                    'size-9 rounded-md flex items-center justify-center transition-colors',
                    localConfig[type].enabled ? 'bg-primary/10' : 'bg-muted'
                  )
                "
              >
                <Icon
                  :icon="getEntityIcon(type)"
                  :class="
                    cn(
                      'size-4',
                      localConfig[type].enabled ? 'text-primary' : 'text-muted-foreground'
                    )
                  "
                />
              </div>
              <span
                :class="
                  cn('font-medium text-sm', !localConfig[type].enabled && 'text-muted-foreground')
                "
              >
                {{ ENTITY_TYPE_CONFIG[type].label }}
              </span>
            </div>

            <!-- Config row - always visible and fully interactive -->
            <div class="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
              <!-- Filter button -->
              <Button
                type="button"
                variant="outline"
                @click="openFilterDialog(type)"
              >
                <Icon
                  icon="icon-[mdi--filter-outline]"
                  class="size-3.5 mr-1"
                />
                {{ m.library.forms.filterLabel }}
                <span
                  v-if="countConditions(localConfig[type].filter) > 0"
                  class="ml-1 text-muted-foreground leading-0"
                >
                  ({{ countConditions(localConfig[type].filter) }})
                </span>
              </Button>

              <div class="flex-1" />

              <!-- Sort controls -->
              <span class="text-xs text-muted-foreground">{{ m.library.forms.sortLabel }}</span>
              <Select v-model="sortFieldModels[type].value">
                <SelectTrigger class="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="field in getSortOptions(type)"
                    :key="field.key"
                    :value="field.key"
                  >
                    {{ field.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select v-model="sortDirectionModels[type].value">
                <SelectTrigger class="w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">{{ m.library.forms.sortAsc }}</SelectItem>
                  <SelectItem value="desc">{{ m.library.forms.sortDesc }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <!-- Explanatory note -->
          <p class="text-xs text-muted-foreground mt-3 px-1 flex items-center">
            <Icon
              icon="icon-[mdi--information-outline]"
              class="size-3.5 mr-1 shrink-0"
            />
            {{ m.library.forms.dynamicConfigHint }}
          </p>
        </div>
      </DialogBody>

      <DialogFooter>
        <Button
          variant="outline"
          :disabled="isSubmitting"
          @click="open = false"
        >
          {{ m.common.cancel }}
        </Button>
        <Button
          :disabled="isSubmitting || !initialized"
          @click="handleConfirm"
        >
          {{ m.common.confirm }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Filter dialog for each entity type -->
  <FilterDialog
    v-if="filterDialogEntityType"
    v-model:open="filterDialogOpen"
    v-model="currentEntityFilter"
    :ui-spec="filterDialogUiSpec!"
  />
</template>

<!--
  LibraryShowcaseSectionItemFormDialog - Form dialog for editing a single section
  Used inline within SectionsFormDialog.
  Filter configuration opens in a separate nested dialog.
-->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Field, FieldLabel, FieldContent, FieldGroup } from '@renderer/components/ui/field'
import { Form } from '@renderer/components/ui/form'
import {
  FilterDialog,
  gameFilterUiSpec,
  characterFilterUiSpec,
  personFilterUiSpec,
  companyFilterUiSpec,
  collectionFilterUiSpec,
  tagFilterUiSpec
} from '@renderer/components/shared/filter'
import { createEmptyFilter, countActiveFilters, type FilterState } from '@shared/filter'
import { notify } from '@renderer/core/notify'
import type {
  ShowcaseSectionFormItem,
  SectionLayout,
  SectionItemSize,
  SectionOpenMode,
  SortDirection
} from '@shared/db'
import type { AllEntityType } from '@shared/common'
import { useI18n } from '@renderer/composables/use-i18n'

const { m } = useI18n()

// =============================================================================
// Constants
// =============================================================================

const ENTITY_TYPES = computed<{ value: AllEntityType; label: string }[]>(() =>
  (['game', 'character', 'person', 'company', 'collection', 'tag'] as const).map((value) => ({
    value,
    label: m.value.library.entities[value]
  }))
)

const LAYOUTS = computed(() => [
  { value: 'horizontal', label: m.value.library.showcase.layoutHorizontal },
  { value: 'grid', label: m.value.library.showcase.layoutGrid }
])

const ITEM_SIZES = computed(() => [
  { value: 'xs', label: m.value.library.showcase.form.cardSizeXs },
  { value: 'sm', label: m.value.library.showcase.form.cardSizeSm },
  { value: 'md', label: m.value.library.showcase.form.cardSizeMd },
  { value: 'lg', label: m.value.library.showcase.form.cardSizeLg },
  { value: 'xl', label: m.value.library.showcase.form.cardSizeXl }
])

const SORT_DIRECTIONS = computed(() => [
  { value: 'asc', label: m.value.library.showcase.form.sortAsc },
  { value: 'desc', label: m.value.library.showcase.form.sortDesc }
])

const OPEN_MODES = computed<{ value: SectionOpenMode; label: string }[]>(() => [
  { value: 'page', label: m.value.library.showcase.form.openModePage },
  { value: 'dialog', label: m.value.library.showcase.form.openModeDialog }
])

// =============================================================================
// Props & Emits
// =============================================================================

interface Props {
  item: ShowcaseSectionFormItem | null
  isNew: boolean
}

const props = defineProps<Props>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  save: [item: ShowcaseSectionFormItem]
  cancel: []
}>()

// =============================================================================
// Form State
// =============================================================================

interface ShowcaseSectionItemFormData {
  name: string
  entityType: AllEntityType
  layout: SectionLayout
  itemSize: SectionItemSize
  openMode: SectionOpenMode
  limit: string
  filter: FilterState
  sortField: string
  sortDirection: SortDirection
}

const formData = ref<ShowcaseSectionItemFormData>({
  name: '',
  entityType: 'game',
  layout: 'horizontal',
  itemSize: 'md',
  openMode: 'page',
  limit: '',
  filter: createEmptyFilter(),
  sortField: 'name',
  sortDirection: 'asc'
})
const isFilterDialogOpen = ref(false)

// Initialize form when dialog opens or item changes
watch(
  [open, () => props.item],
  ([isOpen, item]) => {
    if (isOpen && item) {
      formData.value.name = item.name
      formData.value.entityType = item.entityType
      formData.value.layout = item.layout
      formData.value.itemSize = item.itemSize
      formData.value.openMode = item.openMode
      formData.value.limit = item.limit?.toString() || ''
      formData.value.filter = item.filter
      formData.value.sortField = item.sortField
      formData.value.sortDirection = item.sortDirection
    }
  },
  { immediate: true }
)

// =============================================================================
// Computed
// =============================================================================

const uiSpec = computed(() => getUiSpec(formData.value.entityType))
const sortFields = computed(() => uiSpec.value.sortOptions)
const activeFilterCount = computed(() => countActiveFilters(formData.value.filter))

// Watch for entity type changes - update sort field and reset filter
watch(
  () => formData.value.entityType,
  (newEntityType, oldEntityType) => {
    // Update sort field if current one is not available for new entity type
    const fields = getUiSpec(newEntityType).sortOptions
    if (!fields.find((f) => f.key === formData.value.sortField)) {
      formData.value.sortField = 'name'
    }

    // Reset filter when entity type changes (since fields are different)
    if (props.item && oldEntityType !== newEntityType) {
      formData.value.filter = createEmptyFilter()
    }
  }
)

function getUiSpec(entityType: AllEntityType) {
  switch (entityType) {
    case 'game':
      return gameFilterUiSpec.value
    case 'character':
      return characterFilterUiSpec.value
    case 'person':
      return personFilterUiSpec.value
    case 'company':
      return companyFilterUiSpec.value
    case 'collection':
      return collectionFilterUiSpec.value
    case 'tag':
      return tagFilterUiSpec.value
  }
}

// =============================================================================
// Handlers
// =============================================================================

function handleSubmit() {
  if (!formData.value.name.trim()) {
    notify.error(m.value.library.showcase.form.titleRequired)
    return
  }

  if (!props.item) return

  emit('save', {
    ...props.item,
    name: formData.value.name.trim(),
    entityType: formData.value.entityType,
    layout: formData.value.layout,
    itemSize: formData.value.itemSize,
    openMode: formData.value.openMode,
    limit: formData.value.limit ? parseInt(formData.value.limit, 10) : null,
    filter: formData.value.filter,
    sortField: formData.value.sortField,
    sortDirection: formData.value.sortDirection
  })
}

function handleCancel() {
  emit('cancel')
  open.value = false
}

// Call handleCancel when dialog is closed externally
watch(open, (newOpen, oldOpen) => {
  if (oldOpen && !newOpen) {
    emit('cancel')
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>
          {{ props.isNew ? m.library.showcase.form.addTitle : m.library.showcase.form.editTitle }}
        </DialogTitle>
      </DialogHeader>

      <Form @submit="handleSubmit">
        <DialogBody>
          <FieldGroup>
            <!-- Title -->
            <Field>
              <FieldLabel>{{ m.library.showcase.form.title }}</FieldLabel>
              <FieldContent>
                <Input
                  v-model="formData.name"
                  :placeholder="m.library.showcase.form.titlePlaceholder"
                />
              </FieldContent>
            </Field>

            <!-- Entity Type & Layout -->
            <div class="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>{{ m.library.showcase.form.entityType }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.entityType">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="t in ENTITY_TYPES"
                        :key="t.value"
                        :value="t.value"
                      >
                        {{ t.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.showcase.form.layout }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.layout">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="l in LAYOUTS"
                        :key="l.value"
                        :value="l.value"
                      >
                        {{ l.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            </div>

            <!-- Open Mode -->
            <Field>
              <FieldLabel>{{ m.library.showcase.form.openMode }}</FieldLabel>
              <FieldContent>
                <Select v-model="formData.openMode">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="mode in OPEN_MODES"
                      :key="mode.value"
                      :value="mode.value"
                    >
                      {{ mode.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <!-- Size & Limit -->
            <div class="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel>{{ m.library.showcase.form.cardSize }}</FieldLabel>
                <FieldContent>
                  <Select v-model="formData.itemSize">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="s in ITEM_SIZES"
                        :key="s.value"
                        :value="s.value"
                      >
                        {{ s.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel>{{ m.library.showcase.form.displayCount }}</FieldLabel>
                <FieldContent>
                  <Input
                    v-model="formData.limit"
                    type="number"
                    :placeholder="m.library.showcase.form.displayCountUnlimited"
                    min="1"
                  />
                </FieldContent>
              </Field>
            </div>

            <!-- Sort -->
            <Field>
              <FieldLabel>{{ m.library.showcase.form.sort }}</FieldLabel>
              <FieldContent>
                <div class="flex gap-2">
                  <Select v-model="formData.sortField">
                    <SelectTrigger class="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="f in sortFields"
                        :key="f.key"
                        :value="f.key"
                      >
                        {{ f.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select v-model="formData.sortDirection">
                    <SelectTrigger class="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="d in SORT_DIRECTIONS"
                        :key="d.value"
                        :value="d.value"
                      >
                        {{ d.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </FieldContent>
            </Field>

            <!-- Filter Button -->
            <Field>
              <FieldLabel>{{ m.library.showcase.form.filters }}</FieldLabel>
              <FieldContent>
                <Button
                  type="button"
                  variant="outline"
                  class="w-full justify-start"
                  @click="isFilterDialogOpen = true"
                >
                  <span class="icon-[mdi--filter-outline] size-4 mr-2 text-muted-foreground" />
                  <template v-if="activeFilterCount > 0">
                    {{ m.library.showcase.form.filtersSetCount({ count: activeFilterCount }) }}
                  </template>
                  <template v-else>
                    <span class="text-muted-foreground">
                      {{ m.library.showcase.form.filtersClickToSet }}
                    </span>
                  </template>
                </Button>
              </FieldContent>
            </Field>
          </FieldGroup>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
          >
            {{ m.common.cancel }}
          </Button>
          <Button type="submit">{{ m.common.confirm }}</Button>
        </DialogFooter>
      </Form>
    </DialogContent>
  </Dialog>

  <!-- Nested Filter Dialog -->
  <FilterDialog
    v-if="isFilterDialogOpen"
    v-model:open="isFilterDialogOpen"
    v-model="formData.filter"
    :ui-spec="uiSpec"
  />
</template>

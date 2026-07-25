<!--
  LibraryShowcaseSectionPresetFormDialog - Preset selection dialog
  Dialog for selecting showcase section presets to add.
  Returns sections via @add callback (no DB operations).
-->
<script setup lang="ts">
import { ref, computed } from 'vue'
import { nanoid } from 'nanoid'
import { getShowcaseSectionPresets, type ShowcaseSectionPreset } from './section-presets'
import { useI18n } from '@renderer/composables/use-i18n'
import type { AllEntityType } from '@shared/common'
import type { ShowcaseSectionFormItem } from '@shared/db'
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

const { m } = useI18n()

// =============================================================================
// Props & Emits
// =============================================================================

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  add: [sections: ShowcaseSectionFormItem[]]
}>()

// =============================================================================
// State
// =============================================================================

const selectedIds = ref<Set<string>>(new Set())

// Group presets by entity type for organized display
const presetsByEntityType = computed<Record<AllEntityType, ShowcaseSectionPreset[]>>(() => {
  const result = {} as Record<AllEntityType, ShowcaseSectionPreset[]>
  for (const preset of getShowcaseSectionPresets()) {
    const type = preset.entityType
    if (!result[type]) result[type] = []
    result[type].push(preset)
  }
  return result
})

// =============================================================================
// Handlers
// =============================================================================

function handleToggle(presetId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(presetId)) {
    next.delete(presetId)
  } else {
    next.add(presetId)
  }
  selectedIds.value = next
}

// Helper to create checked model for preset selection
function createSelectedModel(presetId: string) {
  return computed({
    get: () => selectedIds.value.has(presetId),
    set: () => handleToggle(presetId)
  })
}

function handleAdd() {
  if (selectedIds.value.size === 0) return

  const sectionsToAdd: ShowcaseSectionFormItem[] = getShowcaseSectionPresets()
    .filter((p) => selectedIds.value.has(p.id))
    .map((preset, index) => ({
      id: nanoid(),
      entityType: preset.entityType,
      name: preset.name,
      order: index,
      isVisible: true,
      layout: preset.layout,
      itemSize: preset.itemSize,
      openMode: 'page' as const,
      limit: preset.limit,
      filter: preset.filter,
      sortField: preset.sortField,
      sortDirection: preset.sortDirection,
      isNew: true
    }))

  emit('add', sectionsToAdd)
  selectedIds.value = new Set()
  open.value = false
}

function handleCancel() {
  selectedIds.value = new Set()
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>{{ m.library.showcase.presetsDialog.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-auto">
        <template v-if="Object.keys(presetsByEntityType).length === 0">
          <p class="text-sm text-muted-foreground text-center py-8">
            {{ m.library.showcase.presetsDialog.empty }}
          </p>
        </template>
        <template v-else>
          <div class="space-y-4">
            <div
              v-for="(presets, entityType) in presetsByEntityType"
              :key="entityType"
              class="space-y-1"
            >
              <div class="flex items-center text-xs font-medium text-muted-foreground px-1">
                {{ m.library.entities[entityType] || entityType }}
              </div>
              <label
                v-for="preset in presets"
                :key="preset.id"
                class="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 cursor-pointer"
              >
                <Checkbox
                  v-model="createSelectedModel(preset.id).value"
                  class="mt-0.5"
                />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium">{{ preset.name }}</div>
                  <div class="text-xs text-muted-foreground">{{ preset.description }}</div>
                </div>
              </label>
            </div>
          </div>
        </template>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          @click="handleCancel"
        >
          {{ m.common.cancel }}
        </Button>
        <Button
          :disabled="selectedIds.size === 0"
          @click="handleAdd"
        >
          {{ m.library.showcase.presetsDialog.addWithCount({ count: selectedIds.size }) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

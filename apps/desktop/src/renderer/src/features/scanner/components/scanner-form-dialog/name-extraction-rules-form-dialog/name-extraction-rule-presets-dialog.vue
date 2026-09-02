<script setup lang="ts">
/**
 * Scanner Name Extraction Preset Dialog
 *
 * Preset selector with checkboxes for adding predefined extraction rules.
 */

import { ref, computed, watch } from 'vue'
import { newId } from '@shared/id'
import type { NameExtractionRule } from '@shared/db'
import { getNameExtractionPresets } from './name-extraction-rule-presets'
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
import { StateView } from '@renderer/components/ui/state-view'
import { Checkbox } from '@renderer/components/ui/checkbox'

// =============================================================================
// Props & Model & Emits
// =============================================================================

interface Props {
  /** Patterns of rules already in the list; added rules get fresh ids. */
  existingPatterns: string[]
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

interface Emits {
  (e: 'add', rules: NameExtractionRule[]): void
}

const emit = defineEmits<Emits>()

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const selectedIds = ref<Set<string>>(new Set())

// =============================================================================
// Computed
// =============================================================================

// Added rules carry fresh ids, so "already added" matches by pattern.
const availablePresets = computed(() =>
  getNameExtractionPresets().filter((preset) => !props.existingPatterns.includes(preset.pattern))
)

// =============================================================================
// Reset on Open
// =============================================================================

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      selectedIds.value = new Set()
    }
  },
  { immediate: true }
)

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
  const rulesToAdd: NameExtractionRule[] = getNameExtractionPresets()
    .filter((preset) => selectedIds.value.has(preset.id))
    .map((preset) => ({
      id: newId(),
      description: preset.name,
      pattern: preset.pattern,
      enabled: true
    }))

  emit('add', rulesToAdd)
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
        <DialogTitle>{{ m.scanner.rules.presetsTitle }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-auto">
        <StateView
          v-if="availablePresets.length === 0"
          state="empty"
          :description="m.scanner.rules.presetsAllAdded"
          class="py-8"
        />
        <div
          v-else
          class="space-y-1"
        >
          <label
            v-for="preset in availablePresets"
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
              <div class="text-xs text-muted-foreground font-mono mt-1 truncate">
                {{ preset.pattern }}
              </div>
            </div>
          </label>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          @click="handleCancel"
        >
          {{ m.actions.cancel }}
        </Button>
        <Button
          :disabled="selectedIds.size === 0"
          @click="handleAdd"
        >
          {{ m.scanner.rules.addWithCount({ count: selectedIds.size }) }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

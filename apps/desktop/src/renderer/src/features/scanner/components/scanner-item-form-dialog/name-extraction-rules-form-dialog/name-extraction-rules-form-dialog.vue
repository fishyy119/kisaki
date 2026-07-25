<script setup lang="ts">
/**
 * Scanner Name Extraction Rules Dialog
 *
 * Rules editor dialog:
 * - List of rules with enable/disable toggle
 * - Move up/down controls
 * - Edit/delete actions
 * - Opens rule form dialog and preset dialog
 */

import { ref, computed, watch } from 'vue'
import { nanoid } from 'nanoid'
import type { NameExtractionRule } from '@shared/db'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { ListItem, ListItemActions } from '@renderer/components/ui/list-item'
import { Switch } from '@renderer/components/ui/switch'
import ScannerNameExtractionRulesItemFormDialog from './name-extraction-rule-item-form-dialog.vue'
import ScannerNameExtractionPresetDialog from './name-extraction-rule-presets-dialog.vue'
import { useI18n } from '@renderer/composables/use-i18n'

// =============================================================================
// Props & Model & Emits
// =============================================================================

interface Props {
  rules: NameExtractionRule[]
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

interface Emits {
  (e: 'save', rules: NameExtractionRule[]): void
}

const emit = defineEmits<Emits>()

const { m } = useI18n()

// =============================================================================
// State
// =============================================================================

const localRules = ref<NameExtractionRule[]>([])
const editingRule = ref<NameExtractionRule | null>(null)
const isAddMode = ref(false)
const isPresetDialogOpen = ref(false)

// =============================================================================
// Computed
// =============================================================================

const isRuleFormOpen = computed({
  get: () => editingRule.value !== null,
  set: (value) => {
    if (!value) {
      editingRule.value = null
      isAddMode.value = false
    }
  }
})

// =============================================================================
// Initialize on Open
// =============================================================================

watch(
  () => open.value,
  (isOpen) => {
    if (isOpen) {
      // Copy rules on open
      localRules.value = [...props.rules]
    }
  },
  { immediate: true }
)

// =============================================================================
// Handlers
// =============================================================================

function handleAddNew() {
  editingRule.value = {
    id: nanoid(),
    description: '',
    pattern: '',
    enabled: true
  }
  isAddMode.value = true
}

function handleEdit(rule: NameExtractionRule) {
  editingRule.value = { ...rule }
  isAddMode.value = false
}

function handleRuleSave(updatedRule: NameExtractionRule) {
  if (isAddMode.value) {
    localRules.value = [...localRules.value, updatedRule]
  } else {
    localRules.value = localRules.value.map((r) => (r.id === updatedRule.id ? updatedRule : r))
  }
  editingRule.value = null
  isAddMode.value = false
}

function handleRemove(ruleId: string) {
  localRules.value = localRules.value.filter((r) => r.id !== ruleId)
}

function handleToggleEnabled(ruleId: string) {
  localRules.value = localRules.value.map((r) =>
    r.id === ruleId ? { ...r, enabled: !r.enabled } : r
  )
}

// Helper to create checked model for a specific rule's enabled state
function createEnabledModel(ruleId: string) {
  return computed({
    get: () => localRules.value.find((r) => r.id === ruleId)?.enabled ?? false,
    set: () => handleToggleEnabled(ruleId)
  })
}

function handleMoveUp(index: number) {
  if (index <= 0) return
  const newRules = [...localRules.value]
  ;[newRules[index - 1], newRules[index]] = [newRules[index], newRules[index - 1]]
  localRules.value = newRules
}

function handleMoveDown(index: number) {
  if (index >= localRules.value.length - 1) return
  const newRules = [...localRules.value]
  ;[newRules[index], newRules[index + 1]] = [newRules[index + 1], newRules[index]]
  localRules.value = newRules
}

function handleAddPresets(presetRules: NameExtractionRule[]) {
  localRules.value = [...localRules.value, ...presetRules]
}

function handleSave() {
  emit('save', localRules.value)
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ m.scanner.rules.title }}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] overflow-auto">
        <p
          v-if="localRules.length === 0"
          class="text-sm text-muted-foreground text-center py-8"
        >
          {{ m.scanner.rules.empty }}
        </p>
        <div
          v-else
          class="space-y-1"
        >
          <ListItem
            v-for="(rule, index) in localRules"
            :key="rule.id"
          >
            <template #leading>
              <Switch
                v-model="createEnabledModel(rule.id).value"
                class="shrink-0"
              />
            </template>
            <div class="text-sm font-medium truncate">
              {{ rule.description || m.scanner.rules.unnamedRule }}
            </div>
            <div class="text-xs text-muted-foreground font-mono truncate">
              {{ rule.pattern }}
            </div>
            <template #actions>
              <ListItemActions
                movable
                :is-first="index === 0"
                :is-last="index === localRules.length - 1"
                @move-up="handleMoveUp(index)"
                @move-down="handleMoveDown(index)"
                @edit="handleEdit(rule)"
                @delete="handleRemove(rule.id)"
              />
            </template>
          </ListItem>
        </div>
      </DialogBody>
      <DialogFooter class="flex justify-between">
        <div class="flex gap-2">
          <Button
            type="button"
            variant="outline"
            @click="handleAddNew"
          >
            <Icon
              icon="icon-[mdi--plus]"
              class="size-4 mr-1"
            />
            {{ m.scanner.rules.addRule }}
          </Button>
          <Button
            type="button"
            variant="outline"
            @click="isPresetDialogOpen = true"
          >
            <Icon
              icon="icon-[mdi--format-list-bulleted]"
              class="size-4 mr-1"
            />
            {{ m.scanner.rules.selectPresets }}
          </Button>
        </div>
        <div class="flex gap-2">
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            {{ m.common.cancel }}
          </Button>
          <Button
            type="button"
            @click="handleSave"
          >
            {{ m.common.save }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>

    <ScannerNameExtractionRulesItemFormDialog
      v-if="isRuleFormOpen"
      v-model:open="isRuleFormOpen"
      :rule="editingRule"
      :is-new="isAddMode"
      @save="handleRuleSave"
    />

    <ScannerNameExtractionPresetDialog
      v-if="isPresetDialogOpen"
      v-model:open="isPresetDialogOpen"
      :existing-rule-ids="localRules.map((r) => r.id)"
      @add="handleAddPresets"
    />
  </Dialog>
</template>

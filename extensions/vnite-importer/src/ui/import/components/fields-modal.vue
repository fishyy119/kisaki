<!--
Fields Modal edits the Vnite field selection as a local draft grouped by
field group.
Boundary: emits the draft on save; persistence stays in the extension host.
-->
<script setup lang="ts">
import { reactive } from 'vue'
import type { VniteImportFieldSelection } from '../../../shared/import-wizard'
import { VNITE_FIELD_GROUPS } from '../fields'
import Modal from './modal.vue'

interface Props {
  selection: VniteImportFieldSelection
  saving: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', selection: VniteImportFieldSelection): void
}>()

const draft = reactive(JSON.parse(JSON.stringify(props.selection)) as VniteImportFieldSelection)

function isChecked(group: keyof VniteImportFieldSelection, key: string): boolean {
  return Boolean((draft[group] as Record<string, boolean>)[key])
}

function toggle(group: keyof VniteImportFieldSelection, key: string, checked: boolean): void {
  ;(draft[group] as Record<string, boolean>)[key] = checked
}

function save(): void {
  emit('save', JSON.parse(JSON.stringify(draft)) as VniteImportFieldSelection)
}
</script>

<template>
  <Modal
    title="字段"
    @close="emit('close')"
  >
    <div
      v-for="group in VNITE_FIELD_GROUPS"
      :key="group.key"
      class="field"
    >
      <div class="field-info">
        <span class="field-label">{{ group.label }}</span>
        <span class="field-hint">{{ group.description }}</span>
      </div>
      <div class="field-control check-group">
        <label
          v-for="item in group.items"
          :key="item.key"
        >
          <input
            type="checkbox"
            :checked="isChecked(group.key, item.key)"
            @change="toggle(group.key, item.key, ($event.target as HTMLInputElement).checked)"
          />
          {{ item.label }}
        </label>
      </div>
    </div>

    <template #footer>
      <button
        type="button"
        class="border-transparent bg-primary text-primary-foreground"
        :disabled="props.saving"
        @click="save"
      >
        保存字段
      </button>
    </template>
  </Modal>
</template>

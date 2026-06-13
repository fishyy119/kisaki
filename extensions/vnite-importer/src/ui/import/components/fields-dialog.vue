<!--
Fields Dialog edits the Vnite field selection as a local draft grouped by
field group.
Boundary: emits the draft on save; persistence stays in the extension host.
-->
<script setup lang="ts">
import { reactive } from 'vue'
import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label
} from '@kisaki3/extension-ui-vue'
import type { VniteImportFieldSelection } from '../../../shared/import-wizard'
import { VNITE_FIELD_GROUPS } from '../fields'

interface Props {
  selection: VniteImportFieldSelection
  saving: boolean
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  save: [selection: VniteImportFieldSelection]
}>()

const draft = reactive(structuredClone(props.selection))

function isChecked(group: keyof VniteImportFieldSelection, key: string): boolean {
  return Boolean((draft[group] as Record<string, boolean>)[key])
}

function toggle(group: keyof VniteImportFieldSelection, key: string, checked: boolean): void {
  ;(draft[group] as Record<string, boolean>)[key] = checked
}

function save(): void {
  emit('save', structuredClone(draft))
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-xl">
      <DialogHeader>
        <DialogTitle>导入字段</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[60vh] space-y-4 overflow-y-auto">
        <section
          v-for="group in VNITE_FIELD_GROUPS"
          :key="group.key"
          class="space-y-1.5"
        >
          <div>
            <h3 class="text-sm font-medium">{{ group.label }}</h3>
            <p class="text-xs text-muted-foreground">{{ group.description }}</p>
          </div>
          <div class="grid grid-cols-3 gap-x-3 gap-y-1.5">
            <Label
              v-for="item in group.items"
              :key="item.key"
              class="font-normal"
            >
              <Checkbox
                :model-value="isChecked(group.key, item.key)"
                @update:model-value="(checked) => toggle(group.key, item.key, checked === true)"
              />
              {{ item.label }}
            </Label>
          </div>
        </section>
      </DialogBody>
      <DialogFooter>
        <Button
          variant="outline"
          type="button"
          @click="open = false"
        >
          取消
        </Button>
        <Button
          type="button"
          :disabled="props.saving"
          @click="save"
        >
          保存字段
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

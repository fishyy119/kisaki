<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import type { ExtensionSettingsSessionController, SettingsSurfaceState } from '../session'
import type {
  ExtensionResolvedSettingsRecordListNode,
  ExtensionSettingsSurface
} from '@shared/extension'
import type { SerializableRecord } from '@kisaki/extension-api'

const props = defineProps<{
  node: ExtensionResolvedSettingsRecordListNode
  fieldId: string
  fieldDisabled?: boolean
  state: SettingsSurfaceState<ExtensionSettingsSurface>
  controller: ExtensionSettingsSessionController
}>()

const parseError = ref<string | null>(null)
const jsonValue = ref('')
const rows = computed(() => {
  const current = props.state.draft.values[props.node.id]
  return Array.isArray(current)
    ? current.filter((item): item is SerializableRecord => isRecord(item))
    : []
})
const disabled = computed(
  () =>
    props.fieldDisabled ||
    props.node.disabled ||
    props.controller.isCallbackBusy(props.node.callbackId)
)

watch(
  rows,
  (nextRows) => {
    jsonValue.value = JSON.stringify(nextRows, null, 2)
  },
  { immediate: true }
)

function commit(): void {
  try {
    const parsed = JSON.parse(jsonValue.value) as unknown
    if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
      parseError.value = '请输入对象数组 JSON'
      return
    }

    parseError.value = null
    props.controller.updateValue(props.state, props.node.id, parsed)
    void props.controller.invokeNode({
      surface: props.state,
      fieldId: props.fieldId,
      node: props.node,
      value: parsed
    })
  } catch {
    parseError.value = 'JSON 格式不正确'
  }
}

function isRecord(value: unknown): value is SerializableRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
</script>

<template>
  <div class="w-full space-y-2">
    <div
      v-if="rows.length > 0"
      class="overflow-auto rounded-md border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead
              v-for="column in props.node.columns"
              :key="column.key"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(row, rowIndex) in rows"
            :key="rowIndex"
          >
            <TableCell
              v-for="column in props.node.columns"
              :key="column.key"
            >
              {{ row[column.key] }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <p
      v-else-if="props.node.emptyLabel"
      class="text-sm text-muted-foreground"
    >
      {{ props.node.emptyLabel }}
    </p>

    <Textarea
      v-model="jsonValue"
      class="font-mono text-xs"
      :rows="5"
      :disabled="disabled"
      @blur="commit"
    />
    <p
      v-if="parseError"
      class="text-xs text-destructive"
    >
      {{ parseError }}
    </p>
  </div>
</template>

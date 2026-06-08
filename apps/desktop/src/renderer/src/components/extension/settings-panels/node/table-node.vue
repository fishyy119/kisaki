<script setup lang="ts">
import { computed } from 'vue'
import { notify } from '@renderer/core/notify'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import type { SettingsPanelTableColumn } from '@kisaki3/extension-api'
import type { ExtensionResolvedSettingsPanelTableNode } from '@shared/extension'

interface SettingsPanelTableLinkCell {
  label: string
  href: string
}

const props = defineProps<{
  node: ExtensionResolvedSettingsPanelTableNode
}>()

const columns = computed<readonly SettingsPanelTableColumn[]>(() => {
  if (props.node.columns?.length) {
    return props.node.columns
  }

  const firstRow = props.node.rows[0]
  if (!firstRow) {
    return []
  }

  return Object.keys(firstRow).map((key) => ({ key, label: key }))
})
const hasTruncatedColumns = computed(() => columns.value.some((column) => column.truncate))
const totalColumnWeight = computed(() =>
  columns.value.reduce((total, column) => total + getColumnWeight(column), 0)
)

function getColumnWeight(column: SettingsPanelTableColumn): number {
  return typeof column.weight === 'number' && Number.isFinite(column.weight) && column.weight > 0
    ? column.weight
    : 1
}

function getColumnStyle(column: SettingsPanelTableColumn): Record<string, string> | undefined {
  if (!hasTruncatedColumns.value) {
    return undefined
  }

  return {
    width: `${(getColumnWeight(column) / totalColumnWeight.value) * 100}%`
  }
}

function getCellClass(column: SettingsPanelTableColumn): string | undefined {
  return column.truncate ? 'max-w-0' : undefined
}

function getCellTextClass(column: SettingsPanelTableColumn): string | undefined {
  return column.truncate ? 'block truncate' : undefined
}

function getCellTitle(column: SettingsPanelTableColumn, value: unknown): string | undefined {
  if (!column.truncate) {
    return undefined
  }

  const text = formatCell(value).trim()
  return text || undefined
}

function getLinkTitle(column: SettingsPanelTableColumn, value: unknown): string | undefined {
  if (!column.truncate) {
    return undefined
  }

  return getLinkCell(value)?.label ?? getCellTitle(column, value)
}

function getLinkCell(value: unknown): SettingsPanelTableLinkCell | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  return typeof record.label === 'string' &&
    !!record.label.trim() &&
    typeof record.href === 'string' &&
    !!record.href.trim()
    ? {
        label: record.label.trim(),
        href: record.href.trim()
      }
    : undefined
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'boolean') {
    return value ? '是' : '否'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

async function openLink(href: string): Promise<void> {
  try {
    unwrapIpcVoid(await ipcManager.invoke('native:open-external', href))
  } catch (error) {
    notify.error('打开链接失败', error instanceof Error ? error.message : String(error))
  }
}
</script>

<template>
  <div class="w-full space-y-2">
    <div
      v-if="props.node.title"
      class="text-sm font-medium"
    >
      {{ props.node.title }}
    </div>
    <div
      v-if="props.node.rows.length > 0"
      class="overflow-auto rounded-md border"
    >
      <Table :class="hasTruncatedColumns && 'table-fixed'">
        <colgroup v-if="hasTruncatedColumns">
          <col
            v-for="column in columns"
            :key="column.key"
            :style="getColumnStyle(column)"
          />
        </colgroup>
        <TableHeader class="bg-muted/60">
          <TableRow class="border-border hover:bg-transparent">
            <TableHead
              v-for="column in columns"
              :key="column.key"
              class="text-foreground"
            >
              {{ column.label }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="(row, rowIndex) in props.node.rows"
            :key="rowIndex"
          >
            <TableCell
              v-for="column in columns"
              :key="column.key"
              :class="getCellClass(column)"
            >
              <template v-if="column.kind === 'link'">
                <button
                  v-if="getLinkCell(row[column.key])"
                  type="button"
                  class="inline-flex max-w-full min-w-0 items-center text-left text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  :title="getLinkTitle(column, row[column.key])"
                  @click="openLink(getLinkCell(row[column.key])!.href)"
                >
                  <span class="truncate">{{ getLinkCell(row[column.key])!.label }}</span>
                </button>
                <span
                  v-else
                  :class="getCellTextClass(column)"
                  :title="getCellTitle(column, row[column.key])"
                >
                  {{ formatCell(row[column.key]) }}
                </span>
              </template>
              <template v-else>
                <span
                  :class="getCellTextClass(column)"
                  :title="getCellTitle(column, row[column.key])"
                >
                  {{ formatCell(row[column.key]) }}
                </span>
              </template>
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
  </div>
</template>

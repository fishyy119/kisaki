<!-- Filterable scan issues with separate scanner context and virtualized table rows. -->
<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import { useVirtualizer } from '@tanstack/vue-virtual'
import { and, eq, inArray } from 'drizzle-orm'
import { db, ENTITY_TABLES } from '@renderer/core/db'
import { remToPx } from '@renderer/core/interface-scale'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useLiveQuery } from '@renderer/composables/use-live-query'
import { useI18n } from '@renderer/composables/use-i18n'
import { usePreferencesStore, useScannerStore } from '@renderer/stores'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { Badge } from '@renderer/components/ui/badge'
import { SearchInput } from '@renderer/components/ui/search-input'
import { Toolbar, ToolbarRow } from '@renderer/components/ui/toolbar'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@renderer/components/ui/select'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
  type TableColumn
} from '@renderer/components/ui/table'
import { MEDIA_TYPES, type MediaType } from '@shared/entity-types'
import type { ScannerRunIssueType } from '@shared/scanner'
import { addScannerIgnoredName } from '../ignored-names'
import ScannerResultFixDialog from './scanner-result-fix-dialog.vue'
import {
  getIssueTypeText,
  toIssueFixTarget,
  type ScannerFixTarget,
  type ScannerIssueRow
} from './scanner-issue'

const log = createLogger('Scanner')

type ScannerIssueTypeFilter = 'all' | ScannerRunIssueType

interface Props {
  scannerId?: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const { m } = useI18n()

const scannerStore = useScannerStore()
const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const searchQuery = ref('')
const issueTypeFilter = ref<ScannerIssueTypeFilter>('all')
const fixDialogOpen = ref(false)
const fixTarget = ref<ScannerFixTarget | null>(null)

const issueTypeOptions = computed<{ value: ScannerIssueTypeFilter; label: string }[]>(() => [
  { value: 'all', label: m.value.scanner.issues.allTypes },
  { value: 'metadata-missing', label: getIssueTypeText('metadata-missing') },
  { value: 'scraper-unavailable', label: getIssueTypeText('scraper-unavailable') },
  { value: 'duplicate-external-id', label: getIssueTypeText('duplicate-external-id') },
  {
    value: 'related-entry-not-in-library',
    label: getIssueTypeText('related-entry-not-in-library')
  },
  { value: 'collection-replace-degraded', label: getIssueTypeText('collection-replace-degraded') },
  { value: 'path-unavailable', label: getIssueTypeText('path-unavailable') },
  { value: 'unsupported-entry', label: getIssueTypeText('unsupported-entry') },
  { value: 'asset-persist-failed', label: getIssueTypeText('asset-persist-failed') },
  { value: 'file-sync-failed', label: getIssueTypeText('file-sync-failed') },
  { value: 'unexpected-error', label: getIssueTypeText('unexpected-error') }
])

const issueRowsBase = computed<ScannerIssueRow[]>(() => {
  if (props.scannerId) {
    const state = scannerStore.getScannerState(props.scannerId)
    if (!state) return []

    return state.issues.map((issue) => ({
      scannerId: state.scannerId,
      scannerName: state.scannerName,
      mediaType: state.mediaType,
      issue
    }))
  }

  const rows: ScannerIssueRow[] = []
  for (const state of scannerStore.scannerStates.values()) {
    rows.push(
      ...state.issues.map((issue) => ({
        scannerId: state.scannerId,
        scannerName: state.scannerName,
        mediaType: state.mediaType,
        issue
      }))
    )
  }
  return rows
})

function readIssueEntityId(row: ScannerIssueRow): string | undefined {
  const id = row.issue.existingEntityId ?? row.issue.entityId
  return id && id.length > 0 ? id : undefined
}

/** Related entity ids grouped by the media type of the scanner that produced them. */
const relatedEntityIds = computed(() => {
  const byMediaType = new Map<MediaType, Set<string>>()
  for (const row of issueRowsBase.value) {
    const id = readIssueEntityId(row)
    if (!id) continue

    const ids = byMediaType.get(row.mediaType) ?? new Set<string>()
    ids.add(id)
    byMediaType.set(row.mediaType, ids)
  }
  return byMediaType
})

const { data: relatedEntityNames } = useLiveQuery(
  async () => {
    const names = new Map<string, string>()

    for (const [mediaType, idSet] of relatedEntityIds.value) {
      const ids = [...idSet]
      if (ids.length === 0) continue

      const { table, idColumn, nameColumn, isNsfwColumn } = ENTITY_TABLES[mediaType]
      const rows = await db
        .select({ id: idColumn, name: nameColumn })
        .from(table)
        .where(
          showNsfw.value
            ? inArray(idColumn, ids)
            : and(inArray(idColumn, ids), eq(isNsfwColumn, false))
        )
      for (const row of rows) {
        names.set(row.id as string, row.name as string)
      }
    }

    return names
  },
  {
    watch: [relatedEntityIds, showNsfw],
    invalidate: { tables: MEDIA_TYPES.map((mediaType) => ENTITY_TABLES[mediaType].tableName) }
  }
)

const issueRows = computed<ScannerIssueRow[]>(() => {
  const names = relatedEntityNames.value ?? new Map<string, string>()
  return issueRowsBase.value.map((row) => {
    const relatedEntityId = readIssueEntityId(row)
    return {
      ...row,
      existingEntityName: relatedEntityId ? names.get(relatedEntityId) : undefined
    }
  })
})

const filteredIssueRows = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return issueRows.value.filter((row) => {
    if (issueTypeFilter.value !== 'all' && row.issue.type !== issueTypeFilter.value) {
      return false
    }

    if (!query) return true

    return [
      row.issue.extractedName,
      row.issue.path,
      row.issue.reason,
      row.scannerName,
      row.existingEntityName,
      getIssueTypeText(row.issue.type)
    ]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => value.toLowerCase().includes(query))
  })
})

const issueCount = computed(() => issueRows.value.length)
const isQueryActive = computed(
  () => searchQuery.value.trim().length > 0 || issueTypeFilter.value !== 'all'
)

// Keep every issue field independent; the global view also identifies its scanner.
const issueTableMinWidth = computed(() => (props.scannerId ? '64rem' : '72rem'))
const issueColumns = computed<TableColumn[]>(() => [
  { label: m.value.scanner.issues.table.name },
  ...(!props.scannerId ? [{ label: m.value.scanner.issues.table.scanner, width: '8rem' }] : []),
  { label: m.value.scanner.issues.table.type, width: '11rem' },
  { label: m.value.scanner.issues.table.path, tone: 'muted' },
  { label: m.value.scanner.issues.table.reason, tone: 'muted' },
  { label: m.value.scanner.issues.table.relatedEntity, tone: 'muted' },
  { label: m.value.scanner.issues.table.actions, width: '7rem', align: 'end' }
])

/** Must match TableCell: h-10, with the border included in the row height. */
const ISSUE_ROW_HEIGHT_REM = 2.5
const issueTable = useTemplateRef<InstanceType<typeof Table>>('issueTable')
const issueVirtualizer = useVirtualizer(
  computed(() => {
    const scrollElement = issueTable.value?.scrollElement ?? null
    const rowHeight = remToPx(ISSUE_ROW_HEIGHT_REM)
    return {
      count: filteredIssueRows.value.length,
      getScrollElement: () => scrollElement,
      estimateSize: () => rowHeight,
      overscan: 8
    }
  })
)

const issueVirtualRows = computed(() => issueVirtualizer.value.getVirtualItems())
const issueVisibleRows = computed(() =>
  issueVirtualRows.value.map((virtualRow) => filteredIssueRows.value[virtualRow.index]!)
)
const issuePadTop = computed(() => issueVirtualRows.value[0]?.start ?? 0)
const issuePadBottom = computed(() => {
  const lastRow = issueVirtualRows.value.at(-1)
  return issueVirtualizer.value.getTotalSize() - (lastRow?.end ?? 0)
})

async function handleOpenPath(path: string) {
  try {
    await ipcManager.invoke('native:open-path', { path, ensure: 'folder' })
  } catch (error) {
    log.error('Failed to open scanner issue path:', error)
  }
}

function handleFixIssue(row: ScannerIssueRow) {
  fixTarget.value = toIssueFixTarget(row)
  fixDialogOpen.value = true
}

async function handleAddToExclusion(row: ScannerIssueRow) {
  try {
    const result = await addScannerIgnoredName(row.issue.extractedName)
    if (result === 'empty') return

    notify.success(
      result === 'exists'
        ? m.value.scanner.issues.alreadyExcluded
        : m.value.scanner.issues.addedToExclusion
    )
  } catch (error) {
    notify.error(
      m.value.scanner.issues.excludeFailed,
      error instanceof Error ? error.message : String(error)
    )
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      size="2xl"
      fill
    >
      <DialogHeader>
        <DialogTitle icon="icon-[mdi--alert-outline]">
          {{ m.scanner.issues.title }}
        </DialogTitle>
        <DialogDescription>
          {{ m.scanner.issues.totalCount({ count: issueCount }) }}
        </DialogDescription>
      </DialogHeader>

      <!-- Full-bleed body: rounded to the slab corner since no footer follows -->
      <DialogBody class="flex flex-col overflow-hidden rounded-b-md p-0">
        <Toolbar>
          <ToolbarRow>
            <SearchInput
              v-model="searchQuery"
              :placeholder="m.scanner.issues.searchPlaceholder"
              size="sm"
              class="max-w-xl flex-1"
            />
            <span
              v-if="isQueryActive"
              class="shrink-0 text-xs text-muted-foreground"
            >
              {{ m.values.itemCount({ count: filteredIssueRows.length }) }}
            </span>

            <template #trailing>
              <Select v-model="issueTypeFilter">
                <SelectTrigger
                  size="sm"
                  class="w-36"
                >
                  <span class="truncate">
                    {{
                      issueTypeOptions.find((option) => option.value === issueTypeFilter)?.label ??
                      m.scanner.issues.allTypes
                    }}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="option in issueTypeOptions"
                    :key="option.value"
                    :value="option.value"
                  >
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </template>
          </ToolbarRow>
        </Toolbar>

        <StateView
          v-if="filteredIssueRows.length === 0"
          state="empty"
          :description="m.scanner.issues.noMatch"
          class="h-full min-h-48"
        />

        <div
          v-else
          class="min-h-0 flex-1"
        >
          <Table
            ref="issueTable"
            :key="props.scannerId ?? 'all'"
            fixed-header
            inset
            :columns="issueColumns"
            :min-width="issueTableMinWidth"
          >
            <TableBody>
              <tr
                v-if="issuePadTop > 0"
                aria-hidden="true"
                :style="{ height: `${issuePadTop}px` }"
              />
              <TableRow
                v-for="row in issueVisibleRows"
                :key="`${row.scannerId}:${row.issue.id}`"
                class="border-border"
              >
                <TableCell
                  class="truncate font-medium"
                  :title="row.issue.extractedName"
                >
                  {{ row.issue.extractedName }}
                </TableCell>
                <TableCell
                  v-if="!props.scannerId"
                  class="truncate"
                  :title="row.scannerName"
                >
                  {{ row.scannerName }}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="warning"
                    class="max-w-full"
                    :title="getIssueTypeText(row.issue.type)"
                  >
                    <span class="truncate">{{ getIssueTypeText(row.issue.type) }}</span>
                  </Badge>
                </TableCell>
                <TableCell
                  class="truncate"
                  :title="row.issue.path"
                >
                  {{ row.issue.path }}
                </TableCell>
                <TableCell
                  class="truncate"
                  :title="row.issue.reason"
                >
                  {{ row.issue.reason }}
                </TableCell>
                <TableCell
                  class="truncate"
                  :title="row.existingEntityName"
                >
                  {{ row.existingEntityName || '-' }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground hover:text-foreground"
                      :tooltip="m.scanner.issues.openPath"
                      @click="handleOpenPath(row.issue.path)"
                    >
                      <Icon
                        icon="icon-[mdi--folder-open-outline]"
                        class="size-4"
                      />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground hover:text-foreground"
                      :tooltip="m.scanner.issues.addToExclusion"
                      :disabled="!row.issue.extractedName"
                      @click="handleAddToExclusion(row)"
                    >
                      <Icon
                        icon="icon-[mdi--folder-remove-outline]"
                        class="size-4"
                      />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground hover:text-foreground"
                      :tooltip="m.scanner.issues.fixAndRescrape"
                      :disabled="!row.issue.fixable"
                      @click="handleFixIssue(row)"
                    >
                      <Icon
                        icon="icon-[mdi--database-search-outline]"
                        class="size-4"
                      />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              <tr
                v-if="issuePadBottom > 0"
                aria-hidden="true"
                :style="{ height: `${issuePadBottom}px` }"
              />
            </TableBody>
          </Table>
        </div>
      </DialogBody>
    </DialogContent>
  </Dialog>

  <ScannerResultFixDialog
    v-if="fixDialogOpen && fixTarget"
    v-model:open="fixDialogOpen"
    :problem="fixTarget"
  />
</template>

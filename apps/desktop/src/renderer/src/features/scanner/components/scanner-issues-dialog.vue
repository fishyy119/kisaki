<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { and, eq, inArray } from 'drizzle-orm'
import { db, ENTITY_TABLES } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { useDbChanges } from '@renderer/composables/use-db-changes'
import { useI18n } from '@renderer/composables/use-i18n'
import { usePreferencesStore, useScannerStore } from '@renderer/stores'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
import { StateView } from '@renderer/components/ui/state-view'
import { Badge } from '@renderer/components/ui/badge'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@renderer/components/ui/input-group'
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
  TableHead,
  TableHeader,
  TableRow
} from '@renderer/components/ui/table'
import { MEDIA_TYPES, type MediaType } from '@shared/common'
import type { ScannerRunIssueType } from '@shared/scanner'
import { addScannerIgnoredName } from '../ignored-names'
import ScannerResultFixDialog from './scanner-result-fix-dialog.vue'
import {
  getIssueIcon,
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

const { data: relatedEntityNames, refetch: refetchRelatedEntityNames } = useAsyncData(
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
    watch: [relatedEntityIds, showNsfw]
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
const hasSearch = computed(() => searchQuery.value.trim().length > 0)

const ISSUE_TABLE_COLUMNS = ['', '8rem', '22%', '24%', '16%', '7rem']

function handleClearSearch() {
  searchQuery.value = ''
}

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

const MEDIA_TABLE_NAMES = new Set<string>(
  MEDIA_TYPES.map((mediaType) => ENTITY_TABLES[mediaType].tableName)
)

useDbChanges(({ operation, table }) => {
  if (operation === 'updated' && MEDIA_TABLE_NAMES.has(table)) {
    refetchRelatedEntityNames()
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-5xl">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon
            icon="icon-[mdi--alert-outline]"
            class="size-4 text-warning"
          />
          {{ m.scanner.issues.title }}
        </DialogTitle>
        <DialogDescription>
          {{ m.scanner.issues.totalCount({ count: issueCount }) }}
        </DialogDescription>
      </DialogHeader>

      <DialogBody class="flex max-h-[68vh] flex-col gap-3 overflow-hidden">
        <div class="flex shrink-0 items-center gap-2">
          <InputGroup class="min-w-0 flex-1">
            <InputGroupAddon>
              <Icon
                icon="icon-[mdi--magnify]"
                class="size-4"
              />
            </InputGroupAddon>
            <InputGroupInput
              v-model="searchQuery"
              :placeholder="m.scanner.issues.searchPlaceholder"
            />
            <InputGroupAddon
              v-if="hasSearch"
              align="inline-end"
              class="cursor-pointer"
              @click="handleClearSearch"
            >
              <Icon
                icon="icon-[mdi--close]"
                class="size-4 text-muted-foreground hover:text-foreground"
              />
            </InputGroupAddon>
          </InputGroup>

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
        </div>

        <StateView
          v-if="filteredIssueRows.length === 0"
          state="empty"
          :description="m.scanner.issues.noMatch"
          class="h-40 rounded-md border border-border"
        />

        <div
          v-else
          class="min-h-0 flex-1 overflow-hidden rounded-md border border-border"
        >
          <Table
            fixed-header
            :columns="ISSUE_TABLE_COLUMNS"
          >
            <template #header>
              <TableHeader>
                <TableRow>
                  <TableHead>{{ m.scanner.issues.table.name }}</TableHead>
                  <TableHead>{{ m.scanner.issues.table.type }}</TableHead>
                  <TableHead>{{ m.scanner.issues.table.path }}</TableHead>
                  <TableHead>{{ m.scanner.issues.table.reason }}</TableHead>
                  <TableHead>{{ m.scanner.issues.table.relatedEntity }}</TableHead>
                  <TableHead class="text-right">{{ m.scanner.issues.table.actions }}</TableHead>
                </TableRow>
              </TableHeader>
            </template>

            <TableBody>
              <TableRow
                v-for="row in filteredIssueRows"
                :key="`${row.scannerId}:${row.issue.id}`"
                class="border-border"
              >
                <TableCell>
                  <div class="flex min-w-0 items-center gap-2">
                    <Icon
                      :icon="getIssueIcon(row.issue.type)"
                      class="size-4 shrink-0 text-warning"
                    />
                    <div class="min-w-0">
                      <div class="truncate font-medium">{{ row.issue.extractedName }}</div>
                      <div
                        v-if="!props.scannerId"
                        class="truncate text-muted-foreground"
                      >
                        {{ row.scannerName }}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="warning">{{ getIssueTypeText(row.issue.type) }}</Badge>
                </TableCell>
                <TableCell
                  class="truncate text-muted-foreground"
                  :title="row.issue.path"
                >
                  {{ row.issue.path }}
                </TableCell>
                <TableCell
                  class="truncate text-muted-foreground"
                  :title="row.issue.reason"
                >
                  {{ row.issue.reason }}
                </TableCell>
                <TableCell
                  class="truncate text-muted-foreground"
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

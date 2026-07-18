<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { useEvent } from '@renderer/composables/use-event'
import { usePreferencesStore, useScannerStore } from '@renderer/stores'
import { Icon } from '@renderer/components/ui/icon'
import { Button } from '@renderer/components/ui/button'
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
import { games, settings } from '@shared/db'
import type { ScannerRunIssueType } from '@shared/scanner'
import ScannerResultFixDialog from './scanner-result-fix-dialog.vue'
import {
  getIssueIcon,
  getIssueTypeText,
  toIssueFixTarget,
  type ScannerFixTarget,
  type ScannerIssueRow
} from './scanner-problem'

const log = createLogger('Scanner')

type ScannerIssueTypeFilter = 'all' | ScannerRunIssueType

interface Props {
  scannerId?: string
}

const props = defineProps<Props>()
const open = defineModel<boolean>('open', { required: true })

const scannerStore = useScannerStore()
const preferencesStore = usePreferencesStore()
const { showNsfw } = storeToRefs(preferencesStore)

const searchQuery = ref('')
const issueTypeFilter = ref<ScannerIssueTypeFilter>('all')
const fixDialogOpen = ref(false)
const fixTarget = ref<ScannerFixTarget | null>(null)

const issueTypeOptions: { value: ScannerIssueTypeFilter; label: string }[] = [
  { value: 'all', label: '全部类型' },
  { value: 'metadata-missing', label: getIssueTypeText('metadata-missing') },
  { value: 'scraper-unavailable', label: getIssueTypeText('scraper-unavailable') },
  { value: 'duplicate-external-id', label: getIssueTypeText('duplicate-external-id') },
  { value: 'path-unavailable', label: getIssueTypeText('path-unavailable') },
  { value: 'unsupported-entry', label: getIssueTypeText('unsupported-entry') },
  { value: 'asset-persist-failed', label: getIssueTypeText('asset-persist-failed') },
  { value: 'unexpected-error', label: getIssueTypeText('unexpected-error') }
]

const issueRowsBase = computed<ScannerIssueRow[]>(() => {
  if (props.scannerId) {
    const state = scannerStore.getScannerState(props.scannerId)
    if (!state) return []

    return state.issues.map((issue) => ({
      scannerId: state.scannerId,
      scannerName: state.scannerName,
      issue
    }))
  }

  const rows: ScannerIssueRow[] = []
  for (const state of scannerStore.scannerStates.values()) {
    rows.push(
      ...state.issues.map((issue) => ({
        scannerId: state.scannerId,
        scannerName: state.scannerName,
        issue
      }))
    )
  }
  return rows
})

const relatedGameIds = computed(() => {
  return [
    ...new Set(
      issueRowsBase.value
        .map((row) => row.issue.existingGameId ?? row.issue.gameId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    )
  ]
})

const { data: relatedGameNames, refetch: refetchRelatedGameNames } = useAsyncData(
  async () => {
    const ids = relatedGameIds.value
    const names = new Map<string, string>()
    if (ids.length === 0) return names

    const rows = await db
      .select({ id: games.id, name: games.name })
      .from(games)
      .where(
        showNsfw.value
          ? inArray(games.id, ids)
          : and(inArray(games.id, ids), eq(games.isNsfw, false))
      )

    for (const row of rows) {
      names.set(row.id, row.name)
    }

    return names
  },
  {
    watch: [relatedGameIds, showNsfw]
  }
)

const issueRows = computed<ScannerIssueRow[]>(() => {
  const names = relatedGameNames.value ?? new Map<string, string>()
  return issueRowsBase.value.map((row) => {
    const relatedGameId = row.issue.existingGameId ?? row.issue.gameId
    return {
      ...row,
      existingGameName: relatedGameId ? names.get(relatedGameId) : undefined
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
      row.existingGameName,
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
  const extractedName = row.issue.extractedName.trim()
  if (!extractedName) return

  try {
    const currentSettings = await db.query.settings.findFirst()
    const currentIgnoredNames = currentSettings?.scannerIgnoredNames ?? []
    if (currentIgnoredNames.includes(extractedName)) {
      notify.success('已在排除列表中')
      return
    }

    await db
      .update(settings)
      .set({ scannerIgnoredNames: [...currentIgnoredNames, extractedName] })
      .where(eq(settings.id, 0))
      .run()

    notify.success('已加入扫描排除列表')
  } catch (error) {
    notify.error('加入排除列表失败', error instanceof Error ? error.message : String(error))
  }
}

useEvent('db.updated', (payload) => {
  if (payload.table === 'games') {
    refetchRelatedGameNames()
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
          扫描问题
        </DialogTitle>
        <DialogDescription>共 {{ issueCount }} 项</DialogDescription>
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
              class="text-xs"
              placeholder="搜索名称、路径、原因..."
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
                  '全部类型'
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

        <div
          v-if="filteredIssueRows.length === 0"
          class="flex h-40 items-center justify-center rounded-md border border-border text-sm text-muted-foreground"
        >
          没有匹配的问题
        </div>

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
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>路径</TableHead>
                  <TableHead>原因</TableHead>
                  <TableHead>关联游戏</TableHead>
                  <TableHead class="text-right">操作</TableHead>
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
                        class="truncate text-[11px] text-muted-foreground"
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
                  :title="row.existingGameName"
                >
                  {{ row.existingGameName || '-' }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center justify-end gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground hover:text-foreground"
                      tooltip="打开路径"
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
                      tooltip="加入扫描排除列表"
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
                      tooltip="修正并重新刮削"
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

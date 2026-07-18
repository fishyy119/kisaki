<!--
Automation Page owns automation data, filters, and actions.
-->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { StateView } from '@renderer/components/ui/state-view'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@renderer/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@renderer/components/ui/alert-dialog'
import { notify } from '@renderer/core/notify'
import { createLogger } from '@renderer/core/log'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useAsyncData, useEvent, useRenderState } from '@renderer/composables'
import type { Automation } from '@shared/automation'
import type { CommandListItem } from '@shared/command'
import {
  AutomationDetailsDialog,
  AutomationFormDialog,
  AutomationHeader,
  AutomationRow,
  AutomationToolbar
} from '../components'
import type {
  AutomationSortDirection,
  AutomationSortField,
  AutomationSourceFilter,
  AutomationStatusFilter
} from '../types'

const log = createLogger('Automation')

const AUTOMATION_TABLE_COLUMNS = ['', '20%', '17%', '17%', '12%', '8.25rem']

const searchQuery = ref('')
const statusFilter = ref<AutomationStatusFilter>('all')
const sourceFilter = ref<AutomationSourceFilter>('all')
const sortField = ref<AutomationSortField>('createdAt')
const sortDirection = ref<AutomationSortDirection>('desc')

const runningAutomationIds = ref(new Set<string>())
const busyAutomationIds = ref(new Set<string>())
const formDialogOpen = ref(false)
const detailsDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const editingAutomation = ref<Automation | null>(null)
const detailsAutomation = ref<Automation | null>(null)
const pendingDeleteAutomation = ref<Automation | null>(null)
const deleting = ref(false)

const {
  data: automations,
  isLoading,
  isFetching,
  error,
  refetch: refetchAutomations
} = useAsyncData(fetchAutomations)

const { data: commands, refetch: refetchCommands } = useAsyncData(() =>
  ipcManager.invoke('command:list').then(unwrapIpcData)
)

const state = useRenderState(isLoading, error, automations)
const automationList = computed(() => automations.value ?? [])
const commandList = computed(() => commands.value ?? [])
const commandById = computed(() => {
  const map = new Map<string, CommandListItem>()
  for (const command of commandList.value) {
    map.set(command.id, command)
  }
  return map
})

const filteredAutomations = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let result = automationList.value.filter((automation) => {
    const command = commandById.value.get(automation.commandId)
    const ownerLabel =
      automation.owner.type === 'extension'
        ? (automation.owner.extension.nameSnapshot ?? automation.owner.extension.id)
        : 'app'
    const matchesSearch =
      !query ||
      [automation.name, automation.commandId, ownerLabel, command?.title, command?.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))

    if (!matchesSearch) {
      return false
    }

    if (sourceFilter.value !== 'all' && automation.owner.type !== sourceFilter.value) {
      return false
    }

    switch (statusFilter.value) {
      case 'enabled':
        return automation.enabled
      case 'disabled':
        return !automation.enabled
      case 'running':
        return runningAutomationIds.value.has(automation.id)
      case 'failed':
        return (
          !runningAutomationIds.value.has(automation.id) &&
          automation.history[0]?.invocationStatus === 'failed'
        )
      case 'all':
        return true
    }
  })

  result = [...result].sort(compareAutomations)
  return result
})

const selectedDetailsAutomation = computed(() =>
  detailsAutomation.value
    ? (automationList.value.find((automation) => automation.id === detailsAutomation.value?.id) ??
      detailsAutomation.value)
    : null
)
const selectedDetailsCommand = computed(() =>
  selectedDetailsAutomation.value
    ? commandById.value.get(selectedDetailsAutomation.value.commandId)
    : undefined
)

async function fetchAutomations(): Promise<Automation[]> {
  const [items, runningIds] = await Promise.all([
    ipcManager.invoke('automation:list').then(unwrapIpcData),
    ipcManager.invoke('automation:list-running').then(unwrapIpcData)
  ])
  runningAutomationIds.value = new Set(runningIds)
  return items
}

useEvent('automation.changed', () => {
  void refreshAll()
})

useEvent('automation.deleted', ({ automationId }) => {
  removeFromSet(runningAutomationIds, automationId)
  void refreshAll()
})

useEvent('automation.started', ({ automationId }) => {
  addToSet(runningAutomationIds, automationId)
  void refetchAutomations()
})

useEvent('automation.finished', (record) => {
  removeFromSet(runningAutomationIds, record.automationId)
  void refetchAutomations()
})

function compareAutomations(left: Automation, right: Automation): number {
  let comparison = 0
  switch (sortField.value) {
    case 'name':
      comparison = left.name.localeCompare(right.name)
      break
    case 'lastRunAt':
      comparison = (left.lastRunAt ?? 0) - (right.lastRunAt ?? 0)
      break
    case 'nextRunAt':
      comparison = getNextRunSortValue(left) - getNextRunSortValue(right)
      break
    case 'createdAt':
      comparison = left.createdAt - right.createdAt
      break
  }

  return sortDirection.value === 'asc' ? comparison : -comparison
}

function getNextRunSortValue(automation: Automation): number {
  return automation.nextRunAt ?? Number.MAX_SAFE_INTEGER
}

function getCommand(automation: Automation): CommandListItem | undefined {
  return commandById.value.get(automation.commandId)
}

function isAutomationRunning(automationId: string): boolean {
  return runningAutomationIds.value.has(automationId)
}

function isAutomationBusy(automationId: string): boolean {
  return busyAutomationIds.value.has(automationId)
}

function openCreateDialog() {
  editingAutomation.value = null
  formDialogOpen.value = true
}

function openEditDialog(automation: Automation) {
  editingAutomation.value = automation
  formDialogOpen.value = true
}

function openDetailsDialog(automation: Automation) {
  detailsAutomation.value = automation
  detailsDialogOpen.value = true
}

function requestDeleteAutomation(automation: Automation) {
  pendingDeleteAutomation.value = automation
  deleteDialogOpen.value = true
}

async function refreshAll() {
  await Promise.all([refetchAutomations(), refetchCommands()])
}

async function handleSaved() {
  await refreshAll()
}

async function handleRun(automation: Automation) {
  addToSet(runningAutomationIds, automation.id)
  try {
    const record = unwrapIpcData(await ipcManager.invoke('automation:run', automation.id))
    if (!record) {
      notify.info('自动化未触发')
    } else if (record.invocationStatus === 'completed') {
      notify.success('自动化调用已完成')
    } else {
      notify.error('自动化调用失败', record.error?.message)
    }
  } catch (error) {
    log.error('Failed to run Automation:', error)
    notify.error('运行自动化失败', error instanceof Error ? error.message : String(error))
  } finally {
    removeFromSet(runningAutomationIds, automation.id)
    await refetchAutomations()
  }
}

async function handleCancel(automation: Automation) {
  setBusy(automation.id, true)
  try {
    const cancelled = unwrapIpcData(await ipcManager.invoke('automation:cancel', automation.id))
    if (cancelled) {
      notify.info('已请求停止自动化重试')
    } else {
      notify.info('自动化未在运行')
      removeFromSet(runningAutomationIds, automation.id)
    }
  } catch (error) {
    log.error('Failed to cancel Automation:', error)
    notify.error('停止自动化失败', error instanceof Error ? error.message : String(error))
  } finally {
    setBusy(automation.id, false)
  }
}

async function handleSetEnabled(automation: Automation, enabled: boolean) {
  setBusy(automation.id, true)
  try {
    unwrapIpcData(await ipcManager.invoke('automation:set-enabled', automation.id, enabled))
    notify.success(enabled ? '自动化已启用' : '自动化已禁用')
    await refetchAutomations()
  } catch (error) {
    log.error('Failed to toggle Automation:', error)
    notify.error('更新自动化失败', error instanceof Error ? error.message : String(error))
  } finally {
    setBusy(automation.id, false)
  }
}

async function handleDeleteConfirmed() {
  const automation = pendingDeleteAutomation.value
  if (!automation) {
    return
  }

  deleting.value = true
  setBusy(automation.id, true)
  try {
    unwrapIpcVoid(await ipcManager.invoke('automation:delete', automation.id))
    notify.success('自动化已删除')
    deleteDialogOpen.value = false
    pendingDeleteAutomation.value = null
    await refetchAutomations()
  } catch (error) {
    log.error('Failed to delete Automation:', error)
    notify.error('删除自动化失败', error instanceof Error ? error.message : String(error))
  } finally {
    setBusy(automation.id, false)
    deleting.value = false
  }
}

function setBusy(automationId: string, busy: boolean) {
  if (busy) {
    addToSet(busyAutomationIds, automationId)
  } else {
    removeFromSet(busyAutomationIds, automationId)
  }
}

function addToSet(target: typeof runningAutomationIds, value: string) {
  const next = new Set(target.value)
  next.add(value)
  target.value = next
}

function removeFromSet(target: typeof runningAutomationIds, value: string) {
  const next = new Set(target.value)
  next.delete(value)
  target.value = next
}
</script>

<template>
  <div class="flex h-full flex-col">
    <AutomationHeader
      :total-automations="automationList.length"
      :running-automations="runningAutomationIds.size"
      :refreshing="isFetching"
      @create="openCreateDialog"
      @refresh="refreshAll"
    />

    <div class="flex min-h-0 flex-1 flex-col bg-background">
      <AutomationToolbar
        v-model:search-query="searchQuery"
        v-model:status-filter="statusFilter"
        v-model:source-filter="sourceFilter"
        v-model:sort-field="sortField"
        v-model:sort-direction="sortDirection"
        :filtered-count="filteredAutomations.length"
      />

      <div class="min-h-0 flex-1">
        <StateView
          v-if="state === 'loading' || state === 'error'"
          :state="state"
          :error="error"
          class="h-full"
        />

        <StateView
          v-else-if="automationList.length === 0"
          state="empty"
          icon="icon-[mdi--timer-outline]"
          description="暂无自动化"
          class="h-full"
        />

        <StateView
          v-else-if="filteredAutomations.length === 0"
          state="empty"
          icon="icon-[mdi--filter-off-outline]"
          description="没有匹配的自动化"
          class="h-full"
        />

        <Table
          v-else
          fixed-header
          :columns="AUTOMATION_TABLE_COLUMNS"
        >
          <template #header>
            <TableHeader>
              <TableRow class="h-8">
                <TableHead class="pl-4">名称</TableHead>
                <TableHead>命令</TableHead>
                <TableHead>触发</TableHead>
                <TableHead>运行</TableHead>
                <TableHead>状态</TableHead>
                <TableHead class="pr-4 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
          </template>

          <TableBody>
            <AutomationRow
              v-for="automation in filteredAutomations"
              :key="automation.id"
              :automation="automation"
              :command="getCommand(automation)"
              :running="isAutomationRunning(automation.id)"
              :busy="isAutomationBusy(automation.id)"
              @run="handleRun(automation)"
              @cancel="handleCancel(automation)"
              @set-enabled="(enabled) => handleSetEnabled(automation, enabled)"
              @edit="openEditDialog(automation)"
              @details="openDetailsDialog(automation)"
              @delete="requestDeleteAutomation(automation)"
            />
          </TableBody>
        </Table>
      </div>
    </div>

    <AutomationFormDialog
      v-if="formDialogOpen"
      v-model:open="formDialogOpen"
      :automation="editingAutomation"
      @saved="handleSaved"
    />

    <AutomationDetailsDialog
      v-if="detailsDialogOpen && selectedDetailsAutomation"
      v-model:open="detailsDialogOpen"
      :automation="selectedDetailsAutomation"
      :command="selectedDetailsCommand"
      :running="isAutomationRunning(selectedDetailsAutomation.id)"
    />

    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除自动化？</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          确定要删除「{{ pendingDeleteAutomation?.name }}」吗？此操作无法撤销。
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">取消</AlertDialogCancel>
          <AlertDialogAction
            :disabled="deleting"
            @click="handleDeleteConfirmed"
          >
            {{ deleting ? '删除中' : '删除' }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

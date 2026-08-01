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
import { useI18n } from '@renderer/composables/use-i18n'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { useIpc } from '@renderer/composables'
import type { Automation } from '@shared/automation'
import type { CommandListItem } from '@shared/command'
import { useAutomations } from '../composables'
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

const { m } = useI18n()

const searchQuery = ref('')
const statusFilter = ref<AutomationStatusFilter>('all')
const sourceFilter = ref<AutomationSourceFilter>('all')
const sortField = ref<AutomationSortField>('createdAt')
const sortDirection = ref<AutomationSortDirection>('desc')

const busyAutomationIds = ref(new Set<string>())
const formDialogOpen = ref(false)
const detailsDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const editingAutomation = ref<Automation | null>(null)
const detailsAutomation = ref<Automation | null>(null)
const pendingDeleteAutomation = ref<Automation | null>(null)
const deleting = ref(false)

// Data (settled during navigation by the route loader)
const {
  automations: automationList,
  commands: commandList,
  runningAutomationIds,
  error,
  isFetching,
  refetch
} = useAutomations()
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

useIpc('automation:changed', () => {
  void refetch()
})

useIpc('automation:deleted', (_e, { automationId }) => {
  removeFromSet(runningAutomationIds, automationId)
  void refetch()
})

useIpc('automation:run-started', (_e, { automationId }) => {
  addToSet(runningAutomationIds, automationId)
  void refetch()
})

useIpc('automation:run-finished', (_e, record) => {
  removeFromSet(runningAutomationIds, record.automationId)
  void refetch()
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

async function handleSaved() {
  await refetch()
}

async function handleRun(automation: Automation) {
  addToSet(runningAutomationIds, automation.id)
  try {
    const record = unwrapIpcData(await ipcManager.invoke('automation:run', automation.id))
    if (!record) {
      notify.info(m.value.automation.feedback.notTriggered)
    } else if (record.invocationStatus === 'completed') {
      notify.success(m.value.automation.feedback.runCompleted)
    } else {
      notify.error(m.value.automation.feedback.runFailed, record.error?.message)
    }
  } catch (error) {
    log.error('Failed to run Automation:', error)
    notify.error(
      m.value.automation.feedback.runError,
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    removeFromSet(runningAutomationIds, automation.id)
    await refetch()
  }
}

async function handleCancel(automation: Automation) {
  setBusy(automation.id, true)
  try {
    const cancelled = unwrapIpcData(await ipcManager.invoke('automation:cancel', automation.id))
    if (cancelled) {
      notify.info(m.value.automation.feedback.stopRequested)
    } else {
      notify.info(m.value.automation.feedback.notRunning)
      removeFromSet(runningAutomationIds, automation.id)
    }
  } catch (error) {
    log.error('Failed to cancel Automation:', error)
    notify.error(
      m.value.automation.feedback.stopFailed,
      error instanceof Error ? error.message : String(error)
    )
  } finally {
    setBusy(automation.id, false)
  }
}

async function handleSetEnabled(automation: Automation, enabled: boolean) {
  setBusy(automation.id, true)
  try {
    unwrapIpcData(await ipcManager.invoke('automation:set-enabled', automation.id, enabled))
    notify.success(
      enabled ? m.value.automation.feedback.enabled : m.value.automation.feedback.disabled
    )
    await refetch()
  } catch (error) {
    log.error('Failed to toggle Automation:', error)
    notify.error(
      m.value.automation.feedback.updateFailed,
      error instanceof Error ? error.message : String(error)
    )
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
    notify.success(m.value.automation.feedback.deleted)
    deleteDialogOpen.value = false
    pendingDeleteAutomation.value = null
    await refetch()
  } catch (error) {
    log.error('Failed to delete Automation:', error)
    notify.error(
      m.value.automation.feedback.deleteFailed,
      error instanceof Error ? error.message : String(error)
    )
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
      @refresh="refetch"
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
          v-if="error"
          state="error"
          :error="error"
          class="h-full"
        />

        <StateView
          v-else-if="automationList.length === 0"
          state="empty"
          icon="icon-[mdi--timer-outline]"
          :description="m.automation.page.emptyDescription"
          class="h-full"
        />

        <StateView
          v-else-if="filteredAutomations.length === 0"
          state="empty"
          icon="icon-[mdi--filter-off-outline]"
          :description="m.automation.page.noMatchDescription"
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
                <TableHead class="pl-4">{{ m.automation.page.table.name }}</TableHead>
                <TableHead>{{ m.automation.page.table.command }}</TableHead>
                <TableHead>{{ m.automation.page.table.trigger }}</TableHead>
                <TableHead>{{ m.automation.page.table.run }}</TableHead>
                <TableHead>{{ m.automation.page.table.status }}</TableHead>
                <TableHead class="pr-4 text-right">{{ m.automation.page.table.actions }}</TableHead>
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
          <AlertDialogTitle>{{ m.automation.page.deleteTitle }}</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          {{ m.automation.page.deleteDescription({ name: pendingDeleteAutomation?.name ?? '' }) }}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleting">{{ m.common.cancel }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="deleting"
            @click="handleDeleteConfirmed"
          >
            {{ deleting ? m.automation.page.deleting : m.common.delete }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

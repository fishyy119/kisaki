/**
 * Composable: useAutomations
 *
 * Route-loaded automation list with running state and command catalog.
 */

import { computed, ref, watch } from 'vue'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { defineRouteData } from '@renderer/core/route-data'
import type { Automation } from '@shared/automation'
import type { CommandListItem } from '@shared/command'

interface AutomationsData {
  automations: Automation[]
  runningIds: string[]
  commands: CommandListItem[]
}

export const automationsData = defineRouteData(async (): Promise<AutomationsData> => {
  const [automations, runningIds, commands] = await Promise.all([
    ipcManager.invoke('automation:list').then(unwrapIpcData),
    ipcManager.invoke('automation:list-running').then(unwrapIpcData),
    ipcManager.invoke('command:list').then(unwrapIpcData)
  ])
  return { automations, runningIds, commands }
})

export function useAutomations() {
  const { data, error, isFetching, refetch } = automationsData()

  // Event-driven mutations between refetches keep this local Set current;
  // each settled fetch replaces it with the authoritative snapshot.
  const runningAutomationIds = ref(new Set<string>())
  watch(
    () => data.value?.runningIds,
    (ids) => {
      if (ids) runningAutomationIds.value = new Set(ids)
    },
    { immediate: true }
  )

  return {
    automations: computed(() => data.value?.automations ?? []),
    commands: computed(() => data.value?.commands ?? []),
    runningAutomationIds,
    error,
    isFetching,
    refetch
  }
}

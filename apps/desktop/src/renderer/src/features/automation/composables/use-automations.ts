/**
 * Composable: useAutomations
 *
 * Route query of the automation page: the automation list with running state
 * and the command catalog, kept fresh by the automation events the main
 * process pushes.
 */

import { computed } from 'vue'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import { defineRouteQuery } from '@renderer/core/query'
import type { Automation } from '@shared/automation'
import type { CommandListItem } from '@shared/command'

interface AutomationsData {
  automations: Automation[]
  runningIds: string[]
  commands: CommandListItem[]
}

export const automationsQuery = defineRouteQuery({
  name: 'automations',
  key: () => 'automations',
  fetch: async (): Promise<AutomationsData> => {
    const [automations, runningIds, commands] = await Promise.all([
      ipcManager.invoke('automation:list').then(unwrapIpcData),
      ipcManager.invoke('automation:list-running').then(unwrapIpcData),
      ipcManager.invoke('command:list').then(unwrapIpcData)
    ])
    return { automations, runningIds, commands }
  },
  invalidate: {
    ipc: [
      'automation:changed',
      'automation:deleted',
      'automation:run-started',
      'automation:run-finished'
    ]
  }
})

export function useAutomations() {
  const { data, error, isFetching, reload } = automationsQuery()

  return {
    automations: computed(() => data.value?.automations ?? []),
    commands: computed(() => data.value?.commands ?? []),
    runningAutomationIds: computed(() => new Set(data.value?.runningIds ?? [])),
    error,
    isFetching,
    reload
  }
}

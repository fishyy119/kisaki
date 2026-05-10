import { computed, shallowRef } from 'vue'
import { ipcManager, unwrapIpcData } from '@renderer/core/ipc'
import type { ExtensionContributionSnapshot } from '@shared/extension'

function createEmptySnapshot(): ExtensionContributionSnapshot {
  return {
    entityMenus: [],
    settingsPanels: [],
    scraperProviders: [],
    deeplinkRoutes: [],
    themes: []
  }
}

const snapshot = shallowRef<ExtensionContributionSnapshot>(createEmptySnapshot())
let unsubscribe: (() => void) | null = null
let refreshPromise: Promise<ExtensionContributionSnapshot> | null = null

export const extensionContributionStore = {
  snapshot,
  entityMenus: computed(() => snapshot.value.entityMenus),
  settingsPanels: computed(() => snapshot.value.settingsPanels),
  scraperProviders: computed(() => snapshot.value.scraperProviders),
  deeplinkRoutes: computed(() => snapshot.value.deeplinkRoutes),
  themes: computed(() => snapshot.value.themes)
}

export function setupExtensionContributionStore(): void {
  if (unsubscribe) {
    return
  }

  unsubscribe = ipcManager.on('extension:contributions-changed', (_event, nextSnapshot) => {
    snapshot.value = nextSnapshot
  })
}

export async function refreshExtensionContributionSnapshot(): Promise<ExtensionContributionSnapshot> {
  setupExtensionContributionStore()

  if (!refreshPromise) {
    refreshPromise = ipcManager
      .invoke('extension:get-contribution-snapshot')
      .then(unwrapIpcData)
      .then((nextSnapshot) => {
        snapshot.value = nextSnapshot
        return nextSnapshot
      })
      .finally(() => {
        refreshPromise = null
      })
  }

  return refreshPromise
}

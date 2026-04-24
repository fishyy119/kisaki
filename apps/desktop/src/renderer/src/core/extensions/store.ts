import { computed, shallowRef } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { getExtensionContributionSnapshot } from './ipc'
import type { ExtensionContributionSnapshot, ExtensionSettingsPanelInfo } from './types'

function createEmptySnapshot(): ExtensionContributionSnapshot {
  return {
    entityMenus: [],
    settingsPanels: [],
    themes: [],
    deeplinks: [],
    scrapers: []
  }
}

const snapshot = shallowRef<ExtensionContributionSnapshot>(createEmptySnapshot())
let unsubscribe: (() => void) | null = null
let refreshPromise: Promise<ExtensionContributionSnapshot> | null = null

export const extensionContributionStore = {
  snapshot,
  entityMenus: computed(() => snapshot.value.entityMenus),
  settingsPanels: computed(() => snapshot.value.settingsPanels),
  themes: computed(() => snapshot.value.themes),
  deeplinks: computed(() => snapshot.value.deeplinks),
  scrapers: computed(() => snapshot.value.scrapers)
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
    refreshPromise = getExtensionContributionSnapshot()
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

export function getExtensionSettingsPanelsFor(
  extensionId: string
): readonly ExtensionSettingsPanelInfo[] {
  return snapshot.value.settingsPanels.filter((panel) => panel.extensionId === extensionId)
}

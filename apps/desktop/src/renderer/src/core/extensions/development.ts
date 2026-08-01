import { computed, ref, shallowRef } from 'vue'
import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { messages } from '@renderer/core/i18n'
import { notify } from '@renderer/core/notify'

const log = createLogger('Extension')
const reloadActionId = 'reload-extension-host'
const developmentChangeToastId = 'extension-development-stale'
const staleExtensionIds = shallowRef<readonly string[]>([])
const reloadingHost = ref(false)
let unsubscribe: (() => void) | null = null
let receivedStalePush = false

/**
 * Renderer projection of development extensions whose on-disk code is newer than
 * what the extension host is running. The host is not reloaded automatically;
 * this drives the reload affordance so the developer applies changes on demand.
 */
export const extensionDevelopmentStore = {
  staleExtensionIds,
  staleCount: computed(() => staleExtensionIds.value.length),
  hasStaleExtensions: computed(() => staleExtensionIds.value.length > 0),
  reloadingHost: computed(() => reloadingHost.value)
}

export function setupExtensionDevelopmentStore(): void {
  if (unsubscribe) {
    return
  }

  unsubscribe = ipcManager.on('extension:development-stale-changed', (_event, { extensionIds }) => {
    receivedStalePush = true
    const previous = new Set(staleExtensionIds.value)
    const added = extensionIds.filter((extensionId) => !previous.has(extensionId))
    staleExtensionIds.value = extensionIds

    if (added.length > 0) {
      notifyDevelopmentChange(added)
    }
  })

  void seedStaleSnapshot()
}

/**
 * Restarts the extension host and owns the user notifications for the action.
 * Shared by every reload entry point (header button, stale change toast) so
 * they report one in-flight state instead of racing each other.
 */
export async function reloadExtensionHost(): Promise<void> {
  notify.dismiss(developmentChangeToastId)

  if (reloadingHost.value) {
    return
  }

  reloadingHost.value = true
  const toastId = notify.loading(messages.value.extension.host.reloading)

  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:restart-host'))
    notify.update(toastId, {
      title: messages.value.extension.host.reloaded,
      type: 'success',
      duration: 3000
    })
  } catch (error) {
    log.error('Failed to restart extension host:', error)
    notify.update(toastId, {
      title: messages.value.extension.host.reloadFailed,
      message: error instanceof Error ? error.message : String(error),
      type: 'error',
      duration: 5000
    })
  } finally {
    reloadingHost.value = false
  }
}

/**
 * Pulls the current stale set once so a reloaded renderer restores the pending
 * indicator. Pushed changes always win over the snapshot; seeding stays silent
 * because these changes were already announced.
 */
async function seedStaleSnapshot(): Promise<void> {
  try {
    const state = unwrapIpcData(await ipcManager.invoke('extension:get-development-stale'))
    if (!receivedStalePush) {
      staleExtensionIds.value = state.extensionIds
    }
  } catch (error) {
    log.error('Failed to load development stale snapshot:', error)
  }
}

function notifyDevelopmentChange(addedExtensionIds: readonly string[]): void {
  const subject =
    addedExtensionIds.length === 1
      ? messages.value.extension.host.subjectSingle({ id: addedExtensionIds[0] })
      : messages.value.extension.host.subjectMultiple({ count: addedExtensionIds.length })
  notify({
    toastId: developmentChangeToastId,
    title: messages.value.extension.host.codeUpdatedTitle,
    message: messages.value.extension.host.pendingChanges({ subject }),
    type: 'info',
    duration: 10000,
    action: {
      id: reloadActionId,
      label: messages.value.extension.header.reloadProcess
    },
    onAction: () => void reloadExtensionHost()
  })
}

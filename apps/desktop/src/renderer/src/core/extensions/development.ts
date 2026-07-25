import { computed, shallowRef } from 'vue'
import { ipcManager, unwrapIpcVoid } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { messages } from '@renderer/core/i18n'
import { notify } from '@renderer/core/notify'

const log = createLogger('Extension')
const reloadActionId = 'reload-extension-host'
const developmentChangeToastId = 'extension-development-stale'
const staleExtensionIds = shallowRef<readonly string[]>([])
let unsubscribe: (() => void) | null = null
let reloadingExtensionHost = false

/**
 * Renderer projection of development extensions whose on-disk code is newer than
 * what the extension host is running. The host is not reloaded automatically;
 * this drives the reload affordance so the developer applies changes on demand.
 */
export const extensionDevelopmentStore = {
  staleExtensionIds,
  staleCount: computed(() => staleExtensionIds.value.length),
  hasStaleExtensions: computed(() => staleExtensionIds.value.length > 0)
}

export function setupExtensionDevelopmentStore(): void {
  if (unsubscribe) {
    return
  }

  unsubscribe = ipcManager.on('extension:development-stale-changed', (_event, { extensionIds }) => {
    const previous = new Set(staleExtensionIds.value)
    const added = extensionIds.filter((extensionId) => !previous.has(extensionId))
    staleExtensionIds.value = extensionIds

    if (added.length > 0) {
      notifyDevelopmentChange(added)
    }
  })
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
    onAction: () => reloadExtensionHostFromNotification()
  })
}

async function reloadExtensionHostFromNotification(): Promise<void> {
  notify.dismiss(developmentChangeToastId)

  if (reloadingExtensionHost) {
    return
  }

  reloadingExtensionHost = true
  const toastId = notify.loading(messages.value.extension.host.reloading)

  try {
    unwrapIpcVoid(await ipcManager.invoke('extension:restart-host'))
    notify.update(toastId, {
      title: messages.value.extension.host.reloaded,
      type: 'success',
      duration: 3000
    })
  } catch (error) {
    log.error('Failed to restart extension host from notification:', error)
    notify.update(toastId, {
      title: messages.value.extension.host.reloadFailed,
      message: error instanceof Error ? error.message : String(error),
      type: 'error',
      duration: 5000
    })
  } finally {
    reloadingExtensionHost = false
  }
}

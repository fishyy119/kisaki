/**
 * Staged image pick for one form image slot.
 *
 * Holds the keep/set/clear decision plus a downscaled local preview of the
 * picked file, so forms share one pick path and apply the decision through
 * the attachment pipeline on save. Clearing a pending pick restores `keep`
 * first; clearing again stages the removal of the persisted image.
 */

import { ref, type Ref } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenImageDialogOptions } from '@renderer/utils/dialog'
import { useI18n } from './use-i18n'

const log = createLogger('Attachment')

export type StagedImageMode = 'keep' | 'set' | 'clear'

export interface StagedImagePick {
  mode: Ref<StagedImageMode>
  pickedPath: Ref<string | null>
  /** Downscaled data URL of the picked file; null while loading or on failure. */
  previewUrl: Ref<string | null>
  pick: (options?: { title?: string }) => Promise<void>
  clear: () => void
  reset: () => void
}

export function useStagedImagePick(): StagedImagePick {
  const { m } = useI18n()

  const mode = ref<StagedImageMode>('keep')
  const pickedPath = ref<string | null>(null)
  const previewUrl = ref<string | null>(null)

  async function pick(options?: { title?: string }): Promise<void> {
    const dialogResult = await ipcManager.invoke(
      'native:open-dialog',
      getOpenImageDialogOptions(options ?? {})
    )
    if (!dialogResult.success) {
      notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
      return
    }
    const path = dialogResult.data?.filePaths[0]
    if (!path || dialogResult.data?.canceled) return

    mode.value = 'set'
    pickedPath.value = path
    previewUrl.value = null

    // Preview failures degrade to the path text; the save path re-reads the file.
    const preview = await ipcManager.invoke('image:read-preview', { kind: 'path', path })
    if (mode.value !== 'set' || pickedPath.value !== path) return
    if (preview.success) {
      previewUrl.value = preview.data
    } else {
      log.warn('Image preview failed:', preview.error)
    }
  }

  function clear(): void {
    if (mode.value === 'set') {
      reset()
      return
    }
    mode.value = 'clear'
    pickedPath.value = null
    previewUrl.value = null
  }

  function reset(): void {
    mode.value = 'keep'
    pickedPath.value = null
    previewUrl.value = null
  }

  return { mode, pickedPath, previewUrl, pick, clear, reset }
}

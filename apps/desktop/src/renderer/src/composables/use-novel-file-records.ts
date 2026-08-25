/**
 * File record actions for one novel volume.
 *
 * Owns manual attachment, primary election, record removal, and note saving
 * over a volume's file rows, so every surface that lists them shares one
 * mutation path. Disk files are never touched here.
 */

import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenBookDialogOptions } from '@renderer/utils/dialog'
import { novelVolumeFiles, type NovelVolumeFile } from '@shared/db'
import { useI18n } from './use-i18n'

const log = createLogger('Novel')

export interface NovelFileRecords {
  isAttaching: Ref<boolean>
  attachFile: () => Promise<void>
  setPrimary: (file: Pick<NovelVolumeFile, 'id' | 'isPrimary'>) => Promise<void>
  removeFile: (fileId: string) => Promise<void>
  saveNote: (fileId: string, note: string | null) => Promise<void>
}

export function useNovelFileRecords(
  volume: MaybeRefOrGetter<{ id: string; files: NovelVolumeFile[] } | null>
): NovelFileRecords {
  const { m } = useI18n()

  const isAttaching = ref(false)

  async function attachFile(): Promise<void> {
    const owner = toValue(volume)
    if (!owner || isAttaching.value) return

    isAttaching.value = true
    try {
      const dialogResult = await ipcManager.invoke('native:open-dialog', getOpenBookDialogOptions())
      if (!dialogResult.success) {
        notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
        return
      }
      const picked = dialogResult.data?.filePaths[0]
      if (!picked || dialogResult.data?.canceled) return

      const result = await ipcManager.invoke('media-files:attach-novel-volume-file', {
        volumeId: owner.id,
        path: picked
      })
      if (!result.success) {
        notify.error(m.value.novel.files.attachFailed, result.error)
        return
      }

      notify.success(m.value.novel.files.fileAttached)
    } catch (error) {
      log.error('File attach call threw:', error)
      notify.error(m.value.novel.files.attachFailed)
    } finally {
      isAttaching.value = false
    }
  }

  async function setPrimary(file: Pick<NovelVolumeFile, 'id' | 'isPrimary'>): Promise<void> {
    const owner = toValue(volume)
    if (!owner || file.isPrimary) return
    try {
      await db
        .update(novelVolumeFiles)
        .set({ isPrimary: false })
        .where(eq(novelVolumeFiles.volumeId, owner.id))
      await db
        .update(novelVolumeFiles)
        .set({ isPrimary: true })
        .where(eq(novelVolumeFiles.id, file.id))
      notify.success(m.value.novel.files.primaryUpdated)
    } catch (error) {
      log.error('Set primary file failed:', error)
      notify.error(m.value.library.feedback.updateFailed)
    }
  }

  async function removeFile(fileId: string): Promise<void> {
    const owner = toValue(volume)
    if (!owner) return
    try {
      const removed = owner.files.find((file) => file.id === fileId)
      await db.delete(novelVolumeFiles).where(eq(novelVolumeFiles.id, fileId))

      // Keep exactly one primary among the survivors.
      if (removed?.isPrimary) {
        const survivor = owner.files.find((file) => file.id !== fileId)
        if (survivor) {
          await db
            .update(novelVolumeFiles)
            .set({ isPrimary: true })
            .where(eq(novelVolumeFiles.id, survivor.id))
        }
      }

      notify.success(m.value.novel.files.fileRemoved)
    } catch (error) {
      log.error('Remove file record failed:', error)
      notify.error(m.value.common.deleteFailed)
    }
  }

  async function saveNote(fileId: string, note: string | null): Promise<void> {
    try {
      await db.update(novelVolumeFiles).set({ note }).where(eq(novelVolumeFiles.id, fileId))
      notify.success(m.value.novel.files.noteSaved)
    } catch (error) {
      log.error('File note update failed:', error)
      notify.error(m.value.library.feedback.updateFailed)
    }
  }

  return { isAttaching, attachFile, setPrimary, removeFile, saveNote }
}

/** Reveals a file record's path in the system file manager. */
export async function revealNovelFile(path: string): Promise<void> {
  const { m } = useI18n()
  const result = await ipcManager.invoke('native:open-path', { path, ensure: 'file' })
  if (!result.success) {
    notify.error(m.value.novel.files.openFolderFailed)
  }
}

/**
 * File record actions for one movie or one of its extras.
 *
 * Owns manual attachment, primary election, record removal, and note saving
 * over the owner's file rows, so the release list and the extra detail dialog
 * share one mutation path. The target table and the ingest attach call are
 * injected schema facts; disk files are never touched here.
 */

import { ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'
import { notify } from '@renderer/core/notify'
import { getOpenVideoDialogOptions } from '@renderer/utils/dialog'
import { movieExtraFiles, movieFiles, type MovieExtraFile, type MovieFile } from '@shared/db'
import type { IpcVoidResult } from '@shared/ipc'
import { useI18n } from './use-i18n'

const log = createLogger('Movie')

type MovieFileRecord = MovieFile | MovieExtraFile
type MovieFileTable = typeof movieFiles | typeof movieExtraFiles

export interface MovieFileRecordsOptions {
  /** Owner row (the movie or one of its extras) with its current file records. */
  owner: MaybeRefOrGetter<{ id: string; files: MovieFileRecord[] } | null>
  /** File table the mutations target. */
  table: MovieFileTable
  /** FK column scoping the primary election to the owner row. */
  ownerColumn: typeof movieFiles.movieId | typeof movieExtraFiles.extraId
  /** Ingest call attaching a picked path as a user-owned record. */
  attach: (ownerId: string, path: string) => Promise<IpcVoidResult>
}

export interface MovieFileRecords {
  isAttaching: Ref<boolean>
  attachFile: () => Promise<void>
  setPrimary: (file: Pick<MovieFileRecord, 'id' | 'isPrimary'>) => Promise<void>
  removeFile: (fileId: string) => Promise<void>
  saveNote: (fileId: string, note: string | null) => Promise<void>
}

export function useMovieFileRecords(options: MovieFileRecordsOptions): MovieFileRecords {
  const { m } = useI18n()
  const { table, ownerColumn } = options

  const isAttaching = ref(false)

  async function attachFile(): Promise<void> {
    const owner = toValue(options.owner)
    if (!owner || isAttaching.value) return

    isAttaching.value = true
    try {
      const dialogResult = await ipcManager.invoke(
        'native:open-dialog',
        getOpenVideoDialogOptions()
      )
      if (!dialogResult.success) {
        notify.error(dialogResult.error || m.value.library.feedback.pickFileFailed)
        return
      }
      const picked = dialogResult.data?.filePaths[0]
      if (!picked || dialogResult.data?.canceled) return

      const result = await options.attach(owner.id, picked)
      if (!result.success) {
        notify.error(m.value.movie.files.attachFailed, result.error)
        return
      }

      notify.success(m.value.movie.files.fileAttached)
    } catch (error) {
      log.error('File attach call threw:', error)
      notify.error(m.value.movie.files.attachFailed)
    } finally {
      isAttaching.value = false
    }
  }

  async function setPrimary(file: Pick<MovieFileRecord, 'id' | 'isPrimary'>): Promise<void> {
    const owner = toValue(options.owner)
    if (!owner || file.isPrimary) return
    try {
      await db.update(table).set({ isPrimary: false }).where(eq(ownerColumn, owner.id))
      await db.update(table).set({ isPrimary: true }).where(eq(table.id, file.id))
      notify.success(m.value.movie.files.primaryUpdated)
    } catch (error) {
      log.error('Set primary file failed:', error)
      notify.error(m.value.library.feedback.updateFailed)
    }
  }

  async function removeFile(fileId: string): Promise<void> {
    const owner = toValue(options.owner)
    if (!owner) return
    try {
      const removed = owner.files.find((file) => file.id === fileId)
      await db.delete(table).where(eq(table.id, fileId))

      // Keep exactly one primary among the survivors.
      if (removed?.isPrimary) {
        const survivor = owner.files.find((file) => file.id !== fileId)
        if (survivor) {
          await db.update(table).set({ isPrimary: true }).where(eq(table.id, survivor.id))
        }
      }

      notify.success(m.value.movie.files.fileRemoved)
    } catch (error) {
      log.error('Remove file record failed:', error)
      notify.error(m.value.common.deleteFailed)
    }
  }

  async function saveNote(fileId: string, note: string | null): Promise<void> {
    try {
      await db.update(table).set({ note }).where(eq(table.id, fileId))
      notify.success(m.value.movie.files.noteSaved)
    } catch (error) {
      log.error('File note update failed:', error)
      notify.error(m.value.library.feedback.updateFailed)
    }
  }

  return { isAttaching, attachFile, setPrimary, removeFile, saveNote }
}

/** Reveals a file record's path in the system file manager. */
export async function revealMovieFile(path: string): Promise<void> {
  const { m } = useI18n()
  const result = await ipcManager.invoke('native:open-path', { path, ensure: 'file' })
  if (!result.success) {
    notify.error(m.value.movie.files.openFolderFailed)
  }
}

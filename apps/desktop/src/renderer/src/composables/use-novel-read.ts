/**
 * Novel read-state writes shared by volume rows and detail dialogs.
 *
 * `read` is the state, `readAt` the reading evidence: manual toggles record
 * the state alone, and clearing the state also clears the recorded time.
 */

import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { novelVolumes, type NovelVolume } from '@shared/db'
import { useI18n } from './use-i18n'

export async function toggleVolumeRead(volume: Pick<NovelVolume, 'id' | 'read'>): Promise<void> {
  const { m } = useI18n()
  try {
    await db
      .update(novelVolumes)
      .set(
        volume.read
          ? { read: false, readAt: null }
          : { read: true, resumeLocator: null, resumeProgress: null }
      )
      .where(eq(novelVolumes.id, volume.id))
    notify.success(m.value.novel.volumes.readUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

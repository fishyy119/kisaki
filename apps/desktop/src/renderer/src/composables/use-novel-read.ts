/**
 * Novel read-state writes shared by volume rows, detail dialogs, and catch-up.
 *
 * `read` is the state, `readAt` the reading evidence: manual toggles record
 * the state alone, and clearing the state also clears the recorded time.
 */

import { and, count, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { novelVolumes, type NovelStatus, type NovelVolume } from '@shared/db'
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

export async function readUnreadVolumeCount(novelId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(novelVolumes)
    .where(and(eq(novelVolumes.novelId, novelId), eq(novelVolumes.read, false)))

  return rows[0]?.value ?? 0
}

/**
 * Whether writing this status should offer to catch the entry's volumes up.
 *
 * Only `completed` carries a volume meaning; the remaining statuses say
 * nothing about individual volumes, and no status ever implies unmarking one.
 */
export async function shouldOfferReadCatchUp(
  novelId: string,
  status: NovelStatus
): Promise<boolean> {
  if (status !== 'completed') return false
  return (await readUnreadVolumeCount(novelId)) > 0
}

/**
 * Marks every unread volume of the entry as read.
 *
 * Already-read rows are excluded rather than rewritten, so their real reading
 * times and read counts survive and repeating the call is a no-op.
 */
export async function markVolumesRead(novelId: string): Promise<void> {
  await db
    .update(novelVolumes)
    .set({ read: true, resumeLocator: null, resumeProgress: null })
    .where(and(eq(novelVolumes.novelId, novelId), eq(novelVolumes.read, false)))
}

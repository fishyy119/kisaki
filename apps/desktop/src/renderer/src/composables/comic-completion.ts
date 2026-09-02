/**
 * Comic chapter completion: the renderer-side writes to chapter read state,
 * shared by chapter rows, the chapter detail dialog, and catch-up.
 *
 * `read` is the state, `readAt` the reading evidence: manual toggles record
 * the state alone, and clearing the state also clears the recorded time.
 */

import { and, count, eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { comicChapters, type ComicChapter, type MediaStatus } from '@shared/db'
import { useI18n } from './use-i18n'

export async function toggleChapterRead(chapter: Pick<ComicChapter, 'id' | 'read'>): Promise<void> {
  const { m } = useI18n()
  try {
    await db
      .update(comicChapters)
      .set(chapter.read ? { read: false, readAt: null } : { read: true, resumePage: null })
      .where(eq(comicChapters.id, chapter.id))
    notify.success(m.value.comic.chapters.readUpdated)
  } catch {
    notify.error(m.value.library.feedback.updateFailed)
  }
}

export async function readUnreadChapterCount(comicId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(comicChapters)
    .where(and(eq(comicChapters.comicId, comicId), eq(comicChapters.read, false)))

  return rows[0]?.value ?? 0
}

/**
 * Whether writing this status should offer to catch the entry's units up.
 *
 * Only `completed` carries a unit meaning; the remaining statuses say nothing
 * about individual units, and no status ever implies unmarking one.
 */
export async function shouldOfferReadCatchUp(
  comicId: string,
  status: MediaStatus
): Promise<boolean> {
  if (status !== 'completed') return false
  return (await readUnreadChapterCount(comicId)) > 0
}

/**
 * Marks every unread unit of the entry as read.
 *
 * Already-read rows are excluded rather than rewritten, so their real reading
 * times and read counts survive and repeating the call is a no-op.
 */
export async function markChaptersRead(comicId: string): Promise<void> {
  await db
    .update(comicChapters)
    .set({ read: true, resumePage: null })
    .where(and(eq(comicChapters.comicId, comicId), eq(comicChapters.read, false)))
}

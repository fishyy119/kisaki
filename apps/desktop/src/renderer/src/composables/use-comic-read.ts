/**
 * Comic read-state writes shared by unit rows and detail dialogs.
 *
 * `read` is the state, `readAt` the reading evidence: manual toggles record
 * the state alone, and clearing the state also clears the recorded time.
 */

import { eq } from 'drizzle-orm'
import { db } from '@renderer/core/db'
import { notify } from '@renderer/core/notify'
import { comicChapters, type ComicChapter } from '@shared/db'
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

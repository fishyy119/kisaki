/**
 * Reading marks over IPC.
 *
 * A reader window has no library access of its own, so every bookmark and
 * highlight travels through the activity service, which checks each call
 * against the entry this window was opened for. Unlike position reports these
 * are not fire-and-forget: the reader shows what it stored, so a failure has to
 * reach the caller.
 */

import { ipcManager, unwrapIpcData, unwrapIpcVoid } from '@renderer/core/ipc'
import type {
  ComicBookmarkInput,
  ComicBookmarkUpdate,
  NovelBookmarkInput,
  NovelBookmarkUpdate,
  NovelHighlightInput,
  NovelHighlightUpdate
} from '@shared/activity'
import type { ComicBookmark, NovelBookmark, NovelHighlight } from '@shared/db'

export async function fetchNovelBookmarks(novelId: string): Promise<NovelBookmark[]> {
  return unwrapIpcData(await ipcManager.invoke('activity:list-novel-bookmarks', novelId))
}

export async function createNovelBookmark(input: NovelBookmarkInput): Promise<NovelBookmark> {
  return unwrapIpcData(await ipcManager.invoke('activity:create-novel-bookmark', input))
}

export async function updateNovelBookmark(id: string, updates: NovelBookmarkUpdate): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('activity:update-novel-bookmark', id, updates))
}

export async function deleteNovelBookmark(id: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('activity:delete-novel-bookmark', id))
}

export async function fetchNovelHighlights(novelId: string): Promise<NovelHighlight[]> {
  return unwrapIpcData(await ipcManager.invoke('activity:list-novel-highlights', novelId))
}

export async function createNovelHighlight(input: NovelHighlightInput): Promise<NovelHighlight> {
  return unwrapIpcData(await ipcManager.invoke('activity:create-novel-highlight', input))
}

export async function updateNovelHighlight(
  id: string,
  updates: NovelHighlightUpdate
): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('activity:update-novel-highlight', id, updates))
}

export async function deleteNovelHighlight(id: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('activity:delete-novel-highlight', id))
}

export async function fetchComicBookmarks(comicId: string): Promise<ComicBookmark[]> {
  return unwrapIpcData(await ipcManager.invoke('activity:list-comic-bookmarks', comicId))
}

/** Marking a marked page unmarks it; null is the removal outcome. */
export async function toggleComicBookmark(
  input: ComicBookmarkInput
): Promise<ComicBookmark | null> {
  return unwrapIpcData(await ipcManager.invoke('activity:toggle-comic-bookmark', input))
}

export async function updateComicBookmark(id: string, updates: ComicBookmarkUpdate): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('activity:update-comic-bookmark', id, updates))
}

export async function deleteComicBookmark(id: string): Promise<void> {
  unwrapIpcVoid(await ipcManager.invoke('activity:delete-comic-bookmark', id))
}

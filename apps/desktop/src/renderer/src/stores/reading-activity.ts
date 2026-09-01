/**
 * Reading Activity Store
 *
 * Tracks which comic and novel entries have a reader window open, synced from
 * the main process activity service. Reading has no engine to report position
 * from — the reader window owns that — so this holds only which entry and unit
 * are open, which is what cards and read buttons need to show a live state.
 */

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { ipcManager } from '@renderer/core/ipc'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Activity')

export const useReadingActivityStore = defineStore('readingActivity', () => {
  /** Open comic readers keyed by comicId, valued by the unit being read. */
  const comics = shallowRef(new Map<string, string>())
  /** Open novel readers keyed by novelId, valued by the volume being read. */
  const novels = shallowRef(new Map<string, string>())
  const initialized = ref(false)

  function isComicReading(comicId: string): boolean {
    return comics.value.has(comicId)
  }

  function isNovelReading(novelId: string): boolean {
    return novels.value.has(novelId)
  }

  function getReadingChapterId(comicId: string): string | undefined {
    return comics.value.get(comicId)
  }

  function getReadingVolumeId(novelId: string): string | undefined {
    return novels.value.get(novelId)
  }

  function setEntry(map: typeof comics, entryId: string, unitId: string): void {
    const next = new Map(map.value)
    next.set(entryId, unitId)
    map.value = next
  }

  function clearEntry(map: typeof comics, entryId: string): void {
    if (!map.value.has(entryId)) return
    const next = new Map(map.value)
    next.delete(entryId)
    map.value = next
  }

  /** Subscribes to reader lifecycle pushes and seeds the current state once. */
  async function init(): Promise<void> {
    if (initialized.value) return
    initialized.value = true

    ipcManager.on('activity:comic-started', (_, state) => {
      setEntry(comics, state.comicId, state.chapterId)
    })
    ipcManager.on('activity:comic-unit-changed', (_, state) => {
      setEntry(comics, state.comicId, state.chapterId)
    })
    ipcManager.on('activity:comic-stopped', (_, state) => {
      clearEntry(comics, state.comicId)
    })
    ipcManager.on('activity:novel-started', (_, state) => {
      setEntry(novels, state.novelId, state.volumeId)
    })
    ipcManager.on('activity:novel-unit-changed', (_, state) => {
      setEntry(novels, state.novelId, state.volumeId)
    })
    ipcManager.on('activity:novel-stopped', (_, state) => {
      clearEntry(novels, state.novelId)
    })

    try {
      const comicResult = await ipcManager.invoke('activity:list-comic-reading')
      if (comicResult.success) {
        for (const state of comicResult.data) setEntry(comics, state.comicId, state.chapterId)
      }

      const novelResult = await ipcManager.invoke('activity:list-novel-reading')
      if (novelResult.success) {
        for (const state of novelResult.data) setEntry(novels, state.novelId, state.volumeId)
      }
    } catch (error) {
      log.error('Failed to seed reading activity state.', error)
    }
  }

  return {
    comics,
    novels,
    isComicReading,
    isNovelReading,
    getReadingChapterId,
    getReadingVolumeId,
    init
  }
})

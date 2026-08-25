/**
 * Reader module hook points.
 *
 * Owned by ReaderService and dispatched from reader windows' IPC reports and
 * window lifecycle. All are notify hooks: reading mechanics are not
 * negotiable, and the activity handlers only observe them to record read
 * state and sessions.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type {
  ReaderComicProgressReport,
  ReaderNovelProgressReport,
  ReaderUnitOpenedReport
} from '@shared/reader'

export interface ReaderWindowEvent {
  windowId: number
}

export interface ReaderComicProgressEvent extends ReaderWindowEvent {
  report: ReaderComicProgressReport
}

export interface ReaderNovelProgressEvent extends ReaderWindowEvent {
  report: ReaderNovelProgressReport
}

export interface ReaderUnitOpenedEvent extends ReaderWindowEvent {
  report: ReaderUnitOpenedReport
}

export interface ReaderHooks {
  comicProgress: NotifyHook<ReaderComicProgressEvent>
  novelProgress: NotifyHook<ReaderNovelProgressEvent>
  unitOpened: NotifyHook<ReaderUnitOpenedEvent>
  windowClosed: NotifyHook<ReaderWindowEvent>
}

export function createReaderHooks(): ReaderHooks {
  return {
    comicProgress: createNotifyHook<ReaderComicProgressEvent>('reader.comic.progress'),
    novelProgress: createNotifyHook<ReaderNovelProgressEvent>('reader.novel.progress'),
    unitOpened: createNotifyHook<ReaderUnitOpenedEvent>('reader.unit.opened'),
    windowClosed: createNotifyHook<ReaderWindowEvent>('reader.window.closed')
  }
}

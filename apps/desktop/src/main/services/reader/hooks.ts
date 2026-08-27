/**
 * Reader module hook points.
 *
 * Owned by ReaderService and dispatched from reader windows' IPC reports and
 * window lifecycle. All are notify hooks: reading mechanics are not
 * negotiable, and the reading coordinator only observes them to record read
 * state, sessions, and the page-flow override.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type {
  ReaderPageFlowReport,
  ReaderProgressReport,
  ReaderUnitOpenedReport
} from '@shared/reader'

export interface ReaderWindowEvent {
  windowId: number
}

export interface ReaderProgressEvent extends ReaderWindowEvent {
  report: ReaderProgressReport
}

export interface ReaderUnitOpenedEvent extends ReaderWindowEvent {
  report: ReaderUnitOpenedReport
}

export interface ReaderPageFlowEvent extends ReaderWindowEvent {
  report: ReaderPageFlowReport
}

export interface ReaderHooks {
  progress: NotifyHook<ReaderProgressEvent>
  unitOpened: NotifyHook<ReaderUnitOpenedEvent>
  pageFlowChanged: NotifyHook<ReaderPageFlowEvent>
  windowClosed: NotifyHook<ReaderWindowEvent>
}

export function createReaderHooks(): ReaderHooks {
  return {
    progress: createNotifyHook<ReaderProgressEvent>('reader.progress'),
    unitOpened: createNotifyHook<ReaderUnitOpenedEvent>('reader.unit.opened'),
    pageFlowChanged: createNotifyHook<ReaderPageFlowEvent>('reader.page-flow.changed'),
    windowClosed: createNotifyHook<ReaderWindowEvent>('reader.window.closed')
  }
}

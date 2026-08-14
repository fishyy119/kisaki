/**
 * Process module hook points.
 *
 * Owned by ProcessService and dispatched by the watcher. They carry technical
 * facts only: no domain vocabulary, no persistence.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type {
  ProcessForegroundChangedPayload,
  ProcessStartedPayload,
  ProcessStoppedPayload
} from './types'

export interface ProcessHooks {
  processStarted: NotifyHook<ProcessStartedPayload>
  processStopped: NotifyHook<ProcessStoppedPayload>
  foregroundChanged: NotifyHook<ProcessForegroundChangedPayload>
}

export function createProcessHooks(): ProcessHooks {
  return {
    processStarted: createNotifyHook<ProcessStartedPayload>('process.started'),
    processStopped: createNotifyHook<ProcessStoppedPayload>('process.stopped'),
    foregroundChanged: createNotifyHook<ProcessForegroundChangedPayload>(
      'process.foregroundChanged'
    )
  }
}

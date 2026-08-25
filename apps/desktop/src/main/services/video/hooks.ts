/**
 * Video module hook points.
 *
 * Owned by VideoService and dispatched from the playback session lifecycle. All
 * four are notify hooks: playback mechanics are not negotiable, and business
 * services (activity, sync) only observe them to record progress.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type { PlaybackEndReport, PlaybackProgress, PlaybackSessionState } from '@shared/video'

export interface VideoHooks {
  sessionStarted: NotifyHook<PlaybackSessionState>
  statusChanged: NotifyHook<PlaybackSessionState>
  progress: NotifyHook<PlaybackProgress>
  sessionEnded: NotifyHook<PlaybackEndReport>
}

export function createVideoHooks(): VideoHooks {
  return {
    sessionStarted: createNotifyHook<PlaybackSessionState>('video.session.started'),
    statusChanged: createNotifyHook<PlaybackSessionState>('video.session.statusChanged'),
    progress: createNotifyHook<PlaybackProgress>('video.session.progress'),
    sessionEnded: createNotifyHook<PlaybackEndReport>('video.session.ended')
  }
}

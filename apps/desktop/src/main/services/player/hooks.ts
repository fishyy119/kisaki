/**
 * Player module hook points.
 *
 * Owned by PlayerService and dispatched from the session lifecycle. All four are
 * notify hooks: playback mechanics are not negotiable, and business services
 * (activity, sync) only observe them to record progress.
 */

import { createNotifyHook, type NotifyHook } from '@main/hooks'
import type { PlaybackEndReport, PlaybackProgress, PlaybackSessionState } from '@shared/player'

export interface PlayerHooks {
  sessionStarted: NotifyHook<PlaybackSessionState>
  statusChanged: NotifyHook<PlaybackSessionState>
  progress: NotifyHook<PlaybackProgress>
  sessionEnded: NotifyHook<PlaybackEndReport>
}

export function createPlayerHooks(): PlayerHooks {
  return {
    sessionStarted: createNotifyHook<PlaybackSessionState>('player.session.started'),
    statusChanged: createNotifyHook<PlaybackSessionState>('player.session.statusChanged'),
    progress: createNotifyHook<PlaybackProgress>('player.session.progress'),
    sessionEnded: createNotifyHook<PlaybackEndReport>('player.session.ended')
  }
}

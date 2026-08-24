/**
 * mpv command line construction.
 *
 * Kisaki owns resume positions, so playback state that mpv would otherwise
 * persist on its own is disabled here and passed explicitly. Presentation
 * stays user-owned: the app-owned config dir is loaded instead of the
 * system-wide one, and command line options only claim the keys the session
 * machinery depends on, since they always override that config.
 */

import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isWindows } from '@main/env'
import type { PlaybackTarget } from '@shared/player'

/** Returns the platform-specific address mpv should expose its JSON IPC on. */
export function buildIpcSocketPath(sessionId: string): string {
  return isWindows
    ? `\\\\.\\pipe\\kisaki-mpv-${sessionId}`
    : join(tmpdir(), `kisaki-mpv-${sessionId}.sock`)
}

export function buildMpvArguments(
  target: PlaybackTarget,
  socketPath: string,
  configDir: string
): string[] {
  const args = [
    `--config-dir=${configDir}`,
    `--input-ipc-server=${socketPath}`,
    '--no-terminal',
    // Kisaki decides what happens after a file ends, so mpv must stay silent.
    '--idle=no',
    '--keep-open=no',
    '--save-position-on-quit=no',
    '--write-filename-in-watch-later-config=no',
    '--force-window=yes',
    '--sub-auto=fuzzy'
  ]

  if (target.title) {
    args.push(`--force-media-title=${target.title}`, `--title=${target.title}`)
  }

  if (target.startPositionMs && target.startPositionMs > 0) {
    args.push(`--start=${(target.startPositionMs / 1000).toFixed(3)}`)
  }

  args.push('--', target.path)
  return args
}

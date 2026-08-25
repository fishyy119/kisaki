/**
 * Playable container facts.
 *
 * The probing half of the video service: it answers what a file is before the
 * playback half is asked to play it. Successful probes are remembered per
 * (size, mtime) so library re-syncs only pay for files that changed; failures
 * are never stored, letting a transient error retry on the next call.
 */

import { statSync, type Stats } from 'node:fs'
import type { VideoFileInfo } from '@shared/video'
import { probeVideoFile } from './ffprobe'

/** Bounds cache memory for long sessions that probe large libraries. */
const PROBE_CACHE_MAX_ENTRIES = 2048

interface CachedProbe {
  size: number
  mtimeMs: number
  info: VideoFileInfo
}

export class VideoProbe {
  private readonly probeCache = new Map<string, CachedProbe>()

  /** Reads container and track facts, or null when the file cannot be probed. */
  async read(path: string): Promise<VideoFileInfo | null> {
    let stat: Stats
    try {
      stat = statSync(path)
    } catch {
      return null
    }

    const cached = this.probeCache.get(path)
    if (cached && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
      return cached.info
    }

    const info = await probeVideoFile(path)
    if (info) {
      this.rememberProbe(path, stat, info)
    }

    return info
  }

  private rememberProbe(path: string, stat: Stats, info: VideoFileInfo): void {
    // Delete before set so a refreshed entry counts as the newest insertion.
    this.probeCache.delete(path)
    this.probeCache.set(path, { size: stat.size, mtimeMs: stat.mtimeMs, info })

    if (this.probeCache.size > PROBE_CACHE_MAX_ENTRIES) {
      const oldest = this.probeCache.keys().next().value
      if (oldest !== undefined) {
        this.probeCache.delete(oldest)
      }
    }
  }
}

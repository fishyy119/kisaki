/**
 * Video container facts.
 *
 * The ffprobe side of the media-info service: spawns the bundled binary and
 * remembers successful probes per (size, mtime) so library re-syncs only pay
 * for files that changed. Failures are never stored, letting a transient error
 * retry on the next call.
 */

import { statSync, type Stats } from 'node:fs'
import type { MediaFileInfo } from '@shared/media-info'
import { probeMediaFile } from './probe'

/** Bounds cache memory for long sessions that probe large libraries. */
const PROBE_CACHE_MAX_ENTRIES = 2048

interface CachedProbe {
  size: number
  mtimeMs: number
  info: MediaFileInfo
}

export class VideoInfoReader {
  private readonly probeCache = new Map<string, CachedProbe>()

  /** Reads container and track facts, or null when the file cannot be probed. */
  async probe(path: string): Promise<MediaFileInfo | null> {
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

    const info = await probeMediaFile(path)
    if (info) {
      this.rememberProbe(path, stat, info)
    }

    return info
  }

  private rememberProbe(path: string, stat: Stats, info: MediaFileInfo): void {
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

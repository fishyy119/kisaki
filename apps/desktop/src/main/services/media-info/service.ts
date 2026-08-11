/**
 * Media Info Service
 *
 * Technical service for reading container and track facts out of media files
 * (`probe`). It has no database access and no domain vocabulary; ingest and
 * scanner decide what the facts mean for an entity. Main-internal: other
 * services call it directly and nothing is exposed over IPC.
 */

import { statSync, type Stats } from 'node:fs'
import { createLogger } from '@main/log'
import type { IService, ServiceName } from '@main/container'
import type { MediaFileInfo } from '@shared/media-info'
import { probeMediaFile } from './probe'

const log = createLogger('MediaInfo')

/** Bounds cache memory for long sessions that probe large libraries. */
const PROBE_CACHE_MAX_ENTRIES = 2048

interface CachedProbe {
  size: number
  mtimeMs: number
  info: MediaFileInfo
}

export class MediaInfoService implements IService<'media-info'> {
  readonly id = 'media-info'
  readonly deps = [] as const satisfies readonly ServiceName[]

  /**
   * Successful probes keyed by path and validated against (size, mtimeMs):
   * library re-syncs re-probe every file they visit, so unchanged files would
   * otherwise pay the full ffprobe cost each time. Failures are never stored,
   * letting a transient error retry on the next call.
   */
  private readonly probeCache = new Map<string, CachedProbe>()

  async init(): Promise<void> {
    log.info('Initialized')
  }

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

/**
 * Book container facts and page access.
 *
 * The book-side probing engine of the media-info service: in-process container
 * parsing (zip, rar, image directories, PDF) with the same cache discipline as
 * the ffprobe side — successful probes are remembered per (size, mtime) so
 * library re-syncs only pay for files that changed.
 */

import { promises as fs, type Stats } from 'node:fs'
import path from 'node:path'
import { createLogger } from '@main/log'
import type { ComicUnitContainer, ComicUnitFileInfo, NovelFileContainer } from '@shared/media-info'
import {
  countPdfPages,
  listDirectoryPages,
  listRarPages,
  listZipPages,
  pageMimeType,
  readDirectoryPage,
  readRarPage,
  readZipPage,
  resolveComicContainer
} from './containers'

const log = createLogger('MediaInfo')

/** Bounds cache memory for long sessions that probe large libraries. */
const PROBE_CACHE_MAX_ENTRIES = 2048

const NOVEL_CONTAINER_BY_EXTENSION: Record<string, NovelFileContainer> = {
  '.epub': 'epub',
  '.mobi': 'mobi',
  '.azw3': 'azw3',
  '.azw': 'azw3',
  '.fb2': 'fb2',
  '.txt': 'txt',
  '.pdf': 'pdf'
}

interface CachedComicProbe {
  size: number
  mtimeMs: number
  info: ComicUnitFileInfo
}

/** One readable page resolved for a protocol response. */
export interface BookPageContent {
  data: Buffer
  mimeType: string
}

export class BookInfoReader {
  private readonly probeCache = new Map<string, CachedComicProbe>()

  /** Container kind of one novel volume file, or null when unsupported. */
  resolveNovelContainer(filePath: string): NovelFileContainer | null {
    return NOVEL_CONTAINER_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null
  }

  /**
   * Reads container facts of one comic unit file, or null when the path is
   * unreadable or not a supported container.
   */
  async probeComicUnit(filePath: string): Promise<ComicUnitFileInfo | null> {
    let stat: Stats
    try {
      stat = await fs.stat(filePath)
    } catch {
      return null
    }

    const cached = this.probeCache.get(filePath)
    if (cached && cached.size === stat.size && cached.mtimeMs === Math.trunc(stat.mtimeMs)) {
      return cached.info
    }

    const container = await resolveComicContainer(filePath)
    if (!container) return null

    const pageCount = await this.countPages(filePath, container)
    const info: ComicUnitFileInfo = { container, pageCount }
    this.rememberProbe(filePath, stat, info)
    return info
  }

  /** Ordered page entry names of one comic unit file; empty for PDF containers. */
  async listComicPages(filePath: string): Promise<string[]> {
    const container = await resolveComicContainer(filePath)
    if (!container) return []

    switch (container) {
      case 'zip':
        return listZipPages(filePath)
      case 'rar':
        return listRarPages(filePath)
      case 'directory':
        return listDirectoryPages(filePath)
      case 'pdf':
        return []
    }
  }

  /**
   * Reads one page of a comic unit file by index.
   * @throws When the container is unsupported or the index is out of range.
   */
  async readComicPage(filePath: string, pageIndex: number): Promise<BookPageContent> {
    const container = await resolveComicContainer(filePath)
    if (!container || container === 'pdf') {
      throw new Error(`Comic container has no page entries: ${filePath}`)
    }

    const pages = await this.listComicPages(filePath)
    const entryName = pages[pageIndex]
    if (entryName === undefined) {
      throw new Error(`Comic page index out of range: ${pageIndex}`)
    }

    const data = await this.readPageData(filePath, container, entryName)
    return { data, mimeType: pageMimeType(entryName) }
  }

  private async readPageData(
    filePath: string,
    container: Exclude<ComicUnitContainer, 'pdf'>,
    entryName: string
  ): Promise<Buffer> {
    switch (container) {
      case 'zip':
        return readZipPage(filePath, entryName)
      case 'rar':
        return readRarPage(filePath, entryName)
      case 'directory':
        return readDirectoryPage(filePath, entryName)
    }
  }

  private async countPages(
    filePath: string,
    container: ComicUnitContainer
  ): Promise<number | null> {
    try {
      switch (container) {
        case 'zip':
          return (await listZipPages(filePath)).length
        case 'rar':
          return (await listRarPages(filePath)).length
        case 'directory':
          return (await listDirectoryPages(filePath)).length
        case 'pdf':
          return await countPdfPages(filePath)
      }
    } catch (error) {
      log.warn('Failed to count comic pages.', error, { fileName: path.basename(filePath) })
      return null
    }
  }

  private rememberProbe(filePath: string, stat: Stats, info: ComicUnitFileInfo): void {
    // Delete before set so a refreshed entry counts as the newest insertion.
    this.probeCache.delete(filePath)
    this.probeCache.set(filePath, {
      size: stat.size,
      mtimeMs: Math.trunc(stat.mtimeMs),
      info
    })

    if (this.probeCache.size > PROBE_CACHE_MAX_ENTRIES) {
      const oldest = this.probeCache.keys().next().value
      if (oldest !== undefined) {
        this.probeCache.delete(oldest)
      }
    }
  }
}

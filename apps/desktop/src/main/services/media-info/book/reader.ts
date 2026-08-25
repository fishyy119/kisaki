/**
 * Reading-container facts and page access.
 *
 * The reading-container probing engine of the media-info service: in-process
 * parsing (zip, rar, image directories, PDF) with the same cache discipline as
 * the ffprobe side — successful probes are remembered per (size, mtime) so
 * library re-syncs only pay for files that changed, and failures are never
 * remembered so a locked or half-copied file is retried.
 *
 * Page entry lists are cached on the same key: serving pages would otherwise
 * resolve the same ordered list once per page turn.
 */

import { promises as fs, type Stats } from 'node:fs'
import path from 'node:path'
import { createLogger } from '@main/log'
import type { PagedContainer, PagedContainerInfo, DocumentContainer } from '@shared/media-info'
import {
  countPdfPages,
  listDirectoryPages,
  listRarPages,
  listZipPages,
  pageMimeType,
  readDirectoryPage,
  readRarPage,
  readZipPage,
  resolvePagedContainer
} from './containers'

const log = createLogger('MediaInfo')

/** Bounds cache memory for long sessions that probe large libraries. */
const PROBE_CACHE_MAX_ENTRIES = 2048

const DOCUMENT_CONTAINER_BY_EXTENSION: Record<string, DocumentContainer> = {
  '.epub': 'epub',
  '.mobi': 'mobi',
  '.azw3': 'azw3',
  '.azw': 'azw3',
  '.fb2': 'fb2',
  '.txt': 'txt',
  '.pdf': 'pdf'
}

interface FileRevision {
  size: number
  mtimeMs: number
}

interface CachedContainerProbe extends FileRevision {
  info: PagedContainerInfo
}

interface CachedPageEntries extends FileRevision {
  container: PagedContainer
  entries: string[]
}

/** One readable page resolved for a protocol response. */
export interface BookPageContent {
  data: Buffer
  mimeType: string
}

export class BookInfoReader {
  private readonly probeCache = new Map<string, CachedContainerProbe>()
  private readonly entriesCache = new Map<string, CachedPageEntries>()

  /** Document container of one file, or null when the extension is unsupported. */
  resolveDocumentContainer(filePath: string): DocumentContainer | null {
    return DOCUMENT_CONTAINER_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null
  }

  /**
   * Reads facts of one paged container, or null when the path is unreadable
   * or not a supported container.
   */
  async probePagedContainer(filePath: string): Promise<PagedContainerInfo | null> {
    const revision = await readRevision(filePath)
    if (!revision) return null

    const cached = this.probeCache.get(filePath)
    if (cached && matchesRevision(cached, revision)) {
      return cached.info
    }

    const container = await resolvePagedContainer(filePath)
    if (!container) return null

    const pageCount = await this.countPages(filePath, container, revision)
    const info: PagedContainerInfo = { container, pageCount }
    // A failed count is a transient fact about the file, not about the library.
    if (pageCount !== null) {
      remember(this.probeCache, filePath, { ...revision, info })
    }
    return info
  }

  /** Ordered page entry names inside a container; empty for PDF, which has none. */
  async listPages(filePath: string): Promise<string[]> {
    const revision = await readRevision(filePath)
    if (!revision) return []

    const container = await resolvePagedContainer(filePath)
    if (!container) return []

    return this.readPageEntries(filePath, container, revision)
  }

  /**
   * Reads one page of a paged container by index.
   * @throws When the container is unsupported or the index is out of range.
   */
  async readPage(filePath: string, pageIndex: number): Promise<BookPageContent> {
    const revision = await readRevision(filePath)
    const container = revision ? await resolvePagedContainer(filePath) : null
    if (!revision || !container || container === 'pdf') {
      throw new Error(`Container has no page entries: ${filePath}`)
    }

    const pages = await this.readPageEntries(filePath, container, revision)
    const entryName = pages[pageIndex]
    if (entryName === undefined) {
      throw new Error(`Page index out of range: ${pageIndex}`)
    }

    const data = await this.readPageData(filePath, container, entryName)
    return { data, mimeType: pageMimeType(entryName) }
  }

  /** Entry list of one container revision, resolved once and reused per page. */
  private async readPageEntries(
    filePath: string,
    container: PagedContainer,
    revision: FileRevision
  ): Promise<string[]> {
    const cached = this.entriesCache.get(filePath)
    if (cached && cached.container === container && matchesRevision(cached, revision)) {
      return cached.entries
    }

    const entries = await listContainerPages(filePath, container)
    remember(this.entriesCache, filePath, { ...revision, container, entries })
    return entries
  }

  private async readPageData(
    filePath: string,
    container: Exclude<PagedContainer, 'pdf'>,
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
    container: PagedContainer,
    revision: FileRevision
  ): Promise<number | null> {
    try {
      return container === 'pdf'
        ? await countPdfPages(filePath)
        : (await this.readPageEntries(filePath, container, revision)).length
    } catch (error) {
      log.warn('Failed to count container pages.', error, { fileName: path.basename(filePath) })
      return null
    }
  }
}

async function listContainerPages(filePath: string, container: PagedContainer): Promise<string[]> {
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

async function readRevision(filePath: string): Promise<FileRevision | null> {
  let stat: Stats
  try {
    stat = await fs.stat(filePath)
  } catch {
    return null
  }
  return { size: stat.size, mtimeMs: Math.trunc(stat.mtimeMs) }
}

function matchesRevision(cached: FileRevision, revision: FileRevision): boolean {
  return cached.size === revision.size && cached.mtimeMs === revision.mtimeMs
}

/** Insertion-ordered cache write with an eviction bound. */
function remember<T>(cache: Map<string, T>, filePath: string, value: T): void {
  // Delete before set so a refreshed entry counts as the newest insertion.
  cache.delete(filePath)
  cache.set(filePath, value)

  if (cache.size > PROBE_CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) {
      cache.delete(oldest)
    }
  }
}

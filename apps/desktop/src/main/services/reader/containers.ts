/**
 * Paged container access.
 *
 * One module owns how pages are found and read inside each container kind, so
 * probing and page serving share a single implementation. Page order is the
 * natural sort of image entry names, the order every release is authored for.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import StreamZip from 'node-stream-zip'
import { createExtractorFromData } from 'node-unrar-js'
import type { PagedContainer } from '@shared/book'

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.bmp',
  '.jxl'
])

const ZIP_EXTENSIONS = new Set(['.zip', '.cbz'])
const RAR_EXTENSIONS = new Set(['.rar', '.cbr'])

export function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

/** Paged container a path resolves to, or null when unsupported. */
export async function resolvePagedContainer(filePath: string): Promise<PagedContainer | null> {
  try {
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) return 'directory'
  } catch {
    return null
  }

  const extension = path.extname(filePath).toLowerCase()
  if (ZIP_EXTENSIONS.has(extension)) return 'zip'
  if (RAR_EXTENSIONS.has(extension)) return 'rar'
  if (extension === '.pdf') return 'pdf'
  return null
}

/** MIME type of one page entry, for protocol responses. */
export function pageMimeType(entryName: string): string {
  switch (path.extname(entryName).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.avif':
      return 'image/avif'
    case '.bmp':
      return 'image/bmp'
    case '.jxl':
      return 'image/jxl'
    default:
      return 'application/octet-stream'
  }
}

/** Numeric-aware name order, so `page2` sorts before `page10`. */
export function compareNaturalOrder(a: string, b: string): number {
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' })
}

function sortPageEntries(entries: string[]): string[] {
  return entries.sort(compareNaturalOrder)
}

/**
 * Open zip handles most recently read from.
 *
 * Opening a zip parses its central directory, far too expensive to repeat per
 * page turn. Reading interleaves at most a few files (the open book plus
 * probes), so a small pool of live handles serves whole sessions; a handle is
 * discarded once its file changes on disk, errors, sits idle, or the pool
 * rotates past it — and closes only when no read holds it.
 */
interface ZipSession {
  zip: InstanceType<typeof StreamZip.async>
  size: number
  mtimeMs: number
  /** Reads in flight; a session never closes under an active read. */
  active: number
  /** Set when the session leaves the pool; the last read closes the handle. */
  discarded: boolean
  closed: boolean
  idleTimer: NodeJS.Timeout
}

const ZIP_SESSION_IDLE_MS = 60_000
const ZIP_SESSION_LIMIT = 4

const zipSessions = new Map<string, ZipSession>()

async function withZipSession<T>(
  filePath: string,
  use: (zip: InstanceType<typeof StreamZip.async>) => Promise<T>
): Promise<T> {
  const session = await acquireZipSession(filePath)
  session.active += 1
  try {
    const result = await use(session.zip)
    session.active -= 1
    session.idleTimer.refresh()
    maybeCloseZipSession(session)
    return result
  } catch (error) {
    session.active -= 1
    // A failed handle must not serve further reads; the next read reopens.
    discardZipSession(filePath, session)
    throw error
  }
}

async function acquireZipSession(filePath: string): Promise<ZipSession> {
  const stat = await fs.stat(filePath)
  const size = stat.size
  const mtimeMs = Math.trunc(stat.mtimeMs)

  const existing = zipSessions.get(filePath)
  if (existing) {
    if (existing.size === size && existing.mtimeMs === mtimeMs) {
      // Refresh recency so the open book's handle survives probe traffic
      zipSessions.delete(filePath)
      zipSessions.set(filePath, existing)
      existing.idleTimer.refresh()
      return existing
    }
    // The file changed under the handle; stale reads settle on the old one
    discardZipSession(filePath, existing)
  }

  const session: ZipSession = {
    zip: new StreamZip.async({ file: filePath }),
    size,
    mtimeMs,
    active: 0,
    discarded: false,
    closed: false,
    idleTimer: setTimeout(() => discardZipSession(filePath, session), ZIP_SESSION_IDLE_MS)
  }
  session.idleTimer.unref()
  zipSessions.set(filePath, session)

  if (zipSessions.size > ZIP_SESSION_LIMIT) {
    for (const [oldPath, oldSession] of zipSessions) {
      if (oldSession !== session && oldSession.active === 0) {
        discardZipSession(oldPath, oldSession)
        break
      }
    }
  }

  return session
}

/** Detaches one session from the pool; it closes once no read holds it. */
function discardZipSession(filePath: string, session: ZipSession): void {
  if (zipSessions.get(filePath) === session) {
    zipSessions.delete(filePath)
  }
  session.discarded = true
  maybeCloseZipSession(session)
}

function maybeCloseZipSession(session: ZipSession): void {
  if (session.closed || !session.discarded || session.active > 0) return
  session.closed = true
  clearTimeout(session.idleTimer)
  void session.zip.close().catch(() => {
    // The handle is being discarded either way.
  })
}

/** Ordered image entry names inside a zip container. */
export async function listZipPages(filePath: string): Promise<string[]> {
  return withZipSession(filePath, async (zip) => {
    const entries = await zip.entries()
    return sortPageEntries(
      Object.values(entries)
        .filter((entry) => !entry.isDirectory && isImageFile(entry.name))
        .map((entry) => entry.name)
    )
  })
}

/** One page's bytes out of a zip container. */
export async function readZipPage(filePath: string, entryName: string): Promise<Buffer> {
  return withZipSession(filePath, (zip) => zip.entryData(entryName))
}

type RarExtractor = Awaited<ReturnType<typeof createExtractorFromData>>

/**
 * The rar archive most recently read from.
 *
 * Parsing a rar means reading the whole file and handing it to the unrar WASM
 * build, which is far too expensive to repeat per page turn. Reading is
 * sequential within one file, so a single live extractor serves a whole
 * session; it is released once reading moves elsewhere or stops.
 */
interface RarSession {
  filePath: string
  extractor: RarExtractor
  idleTimer: NodeJS.Timeout
}

const RAR_SESSION_IDLE_MS = 60_000

let rarSession: RarSession | null = null

async function acquireRarExtractor(filePath: string): Promise<RarExtractor> {
  if (rarSession?.filePath === filePath) {
    rarSession.idleTimer.refresh()
    return rarSession.extractor
  }

  releaseRarSession()
  const data = await fs.readFile(filePath)
  const extractor = await createExtractorFromData({ data: toArrayBuffer(data) })

  const idleTimer = setTimeout(releaseRarSession, RAR_SESSION_IDLE_MS)
  idleTimer.unref()
  rarSession = { filePath, extractor, idleTimer }
  return extractor
}

function releaseRarSession(): void {
  if (!rarSession) return
  clearTimeout(rarSession.idleTimer)
  rarSession = null
}

/** Ordered image entry names inside a rar container. */
export async function listRarPages(filePath: string): Promise<string[]> {
  const extractor = await acquireRarExtractor(filePath)
  const list = extractor.getFileList()
  const names: string[] = []
  for (const header of list.fileHeaders) {
    if (!header.flags.directory && isImageFile(header.name)) {
      names.push(header.name)
    }
  }
  return sortPageEntries(names)
}

/** One page's bytes out of a rar container. */
export async function readRarPage(filePath: string, entryName: string): Promise<Buffer> {
  const extractor = await acquireRarExtractor(filePath)
  const extracted = extractor.extract({ files: [entryName] })
  for (const file of extracted.files) {
    if (file.extraction) {
      return Buffer.from(file.extraction)
    }
  }
  throw new Error(`Archive entry not found: ${entryName}`)
}

/** Ordered image file names directly inside a directory container. */
export async function listDirectoryPages(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  return sortPageEntries(
    entries.filter((entry) => entry.isFile() && isImageFile(entry.name)).map((entry) => entry.name)
  )
}

/** One page's bytes out of a directory container, confined to direct children. */
export async function readDirectoryPage(dirPath: string, entryName: string): Promise<Buffer> {
  if (entryName.includes('/') || entryName.includes('\\') || entryName.includes('..')) {
    throw new Error(`Page entry escapes its directory: ${entryName}`)
  }
  return fs.readFile(path.join(dirPath, entryName))
}

/**
 * Page count of a PDF file.
 *
 * pdf.js is imported lazily: it is a heavy module that only PDF units pay for.
 */
export async function countPdfPages(filePath: string): Promise<number | null> {
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = await fs.readFile(filePath)
    const loadingTask = getDocument({ data: new Uint8Array(data), disableFontFace: true })
    try {
      const document = await loadingTask.promise
      return document.numPages
    } finally {
      await loadingTask.destroy()
    }
  } catch {
    return null
  }
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(copy).set(buffer)
  return copy
}

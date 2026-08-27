/**
 * Page sources for the image reading engine.
 *
 * A page source turns one unit file into addressable page images. Archive,
 * directory, and image containers hold page entries and stream straight from
 * `book://`, with the page count probed authoritatively from the file as it
 * is on disk. PDF containers carry no images, so their pages are rasterized
 * here, in the renderer, where a canvas exists — re-rasterized per scale
 * bucket, so vector text stays sharp under zoom.
 *
 * Both shapes answer the same questions the engine asks: how many pages,
 * where page N is at a wanted width, and which named places the file offers.
 * Fonts come from the file itself — no CMap or standard font packs are
 * bundled, so a PDF relying on non-embedded CID fonts renders with
 * substitutes.
 */

import { buildComicFileUrl, buildComicPageUrl, buildNovelFileUrl } from '@shared/book'
import { createLogger } from '@renderer/core/log'
import { fetchUnitPageCount } from '../bridge'
import type { ReaderOutlineEntry } from '../outline'

const log = createLogger('Reader')

/**
 * Rasterization widths in device pixels. A page is rendered at the smallest
 * bucket covering what the layout will actually display, so zooming in
 * re-renders instead of upscaling; the cap bounds memory on absurd zooms.
 */
const PDF_SCALE_BUCKETS = [800, 1600, 2400, 3200] as const

/** Preview width; a page grid never needs full reading resolution. */
const PDF_THUMBNAIL_WIDTH = 240

/** Rendered PDF pages held in memory before the oldest are released. */
const PDF_PAGE_CACHE_SIZE = 24

/** Previews are cheap, and a page grid scrolls back and forth over many. */
const PDF_THUMBNAIL_CACHE_SIZE = 96

export interface PageSource {
  /** Total pages, as probed from the file itself. */
  readonly pageCount: number
  /**
   * Displayable URL of one zero-based page.
   * @param targetWidth - Device-pixel width the page will be shown at; lets a
   * rasterizing source pick its render scale. Streamed images ignore it.
   */
  getPageUrl(index: number, targetWidth?: number): Promise<string>
  /** Preview of one page; the page itself where a container holds images. */
  getThumbnailUrl(index: number): Promise<string>
  /** Named places in reading order; empty when the file carries no outline. */
  getOutline(): Promise<ReaderOutlineEntry[]>
  dispose(): void
}

/**
 * Pages served straight out of a container by the main process.
 *
 * Archives and image directories are ordered page images and nothing more, so
 * they have no outline to offer and previews reuse the page itself. The page
 * count is probed over IPC before the source exists, so the engine never
 * pages blind.
 */
export async function createContainerPageSource(fileId: string): Promise<PageSource> {
  const pageCount = await fetchUnitPageCount(fileId)

  const pageUrl = (index: number): Promise<string> =>
    Promise.resolve(buildComicPageUrl(fileId, index))

  return {
    pageCount,
    getPageUrl: pageUrl,
    getThumbnailUrl: pageUrl,
    getOutline: () => Promise.resolve([]),
    dispose: () => {}
  }
}

/** Pages rasterized from a comic PDF file. */
export async function createComicPdfPageSource(fileId: string): Promise<PageSource> {
  return createPdfPageSource(buildComicFileUrl(fileId))
}

/** Pages rasterized from a novel PDF file. */
export async function createNovelPdfPageSource(fileId: string): Promise<PageSource> {
  return createPdfPageSource(buildNovelFileUrl(fileId))
}

async function createPdfPageSource(fileUrl: string): Promise<PageSource> {
  const pdfjs = await loadPdfEngine()

  const response = await fetch(fileUrl)
  if (!response.ok) {
    throw new Error(`Book file request failed with status ${response.status}`)
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) })
  const document = await loadingTask.promise

  const pages = createRenderCache(document, PDF_PAGE_CACHE_SIZE)
  const thumbnails = createRenderCache(document, PDF_THUMBNAIL_CACHE_SIZE)

  return {
    pageCount: document.numPages,
    getPageUrl: (index, targetWidth) => pages.get(index, bucketWidth(targetWidth)),
    getThumbnailUrl: (index) => thumbnails.get(index, PDF_THUMBNAIL_WIDTH),
    getOutline: () => readPdfOutline(document),

    dispose() {
      pages.clear()
      thumbnails.clear()
      void loadingTask.destroy().catch((error: unknown) => {
        log.warn('Failed to release a PDF document.', error)
      })
    }
  }
}

/** Smallest rasterization bucket covering the wanted width. */
function bucketWidth(targetWidth: number | undefined): number {
  const wanted = targetWidth ?? PDF_SCALE_BUCKETS[1]
  return PDF_SCALE_BUCKETS.find((bucket) => bucket >= wanted) ?? PDF_SCALE_BUCKETS.at(-1)!
}

/** Bounded store of rendered pages, addressed by page index and render width. */
function createRenderCache(
  pdfDocument: PdfDocument,
  maxEntries: number
): { get: (index: number, width: number) => Promise<string>; clear: () => void } {
  const urls = new Map<string, string>()

  return {
    async get(index, width) {
      const key = `${index}@${width}`
      const cached = urls.get(key)
      if (cached) return cached

      const url = await renderPageToUrl(pdfDocument, index, width)
      urls.set(key, url)
      // Oldest first: the reader moves through a book, so the pages it has
      // left behind are the ones to release.
      while (urls.size > maxEntries) {
        const oldest = urls.keys().next().value as string
        URL.revokeObjectURL(urls.get(oldest) as string)
        urls.delete(oldest)
      }
      return url
    },

    clear() {
      for (const url of urls.values()) URL.revokeObjectURL(url)
      urls.clear()
    }
  }
}

type PdfEngine = typeof import('pdfjs-dist')
type PdfDocument = Awaited<ReturnType<PdfEngine['getDocument']>['promise']>
type PdfOutlineNode = Awaited<ReturnType<PdfDocument['getOutline']>>[number]

let pdfEngine: Promise<PdfEngine> | null = null

/** Loads pdf.js once per window and points it at the bundled worker. */
function loadPdfEngine(): Promise<PdfEngine> {
  pdfEngine ??= (async () => {
    const [pdfjs, { default: PdfWorker }] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
    ])
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
    return pdfjs
  })()

  return pdfEngine
}

/**
 * Flattens a PDF outline into page entries.
 *
 * Outline destinations address objects rather than pages, so each one is
 * resolved to a page index here. An entry that resolves to nothing is dropped:
 * it could not be navigated to anyway.
 */
async function readPdfOutline(pdfDocument: PdfDocument): Promise<ReaderOutlineEntry[]> {
  const roots = await pdfDocument.getOutline()
  if (!roots) return []

  const entries: ReaderOutlineEntry[] = []

  const collect = async (nodes: PdfOutlineNode[], depth: number): Promise<void> => {
    for (const node of nodes) {
      const label = node.title.trim()
      const target = await resolveOutlinePage(pdfDocument, node.dest)
      if (label && target !== null) entries.push({ label, target, depth })
      if (node.items?.length) await collect(node.items, depth + 1)
    }
  }

  await collect(roots, 0)
  return entries
}

async function resolveOutlinePage(
  pdfDocument: PdfDocument,
  dest: PdfOutlineNode['dest']
): Promise<number | null> {
  try {
    const resolved = typeof dest === 'string' ? await pdfDocument.getDestination(dest) : dest
    const target = resolved?.[0]
    if (typeof target === 'number') return target
    if (target === null || target === undefined) return null
    return await pdfDocument.getPageIndex(target)
  } catch (error) {
    log.warn('Failed to resolve a PDF outline destination.', error)
    return null
  }
}

async function renderPageToUrl(
  pdfDocument: PdfDocument,
  index: number,
  width: number
): Promise<string> {
  const page = await pdfDocument.getPage(index + 1)
  try {
    const baseViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: width / baseViewport.width })

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('The reader could not acquire a 2D canvas for PDF rendering')
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', 0.92)
    })
    if (!blob) {
      throw new Error('The reader could not encode a rendered PDF page')
    }
    return URL.createObjectURL(blob)
  } finally {
    page.cleanup()
  }
}

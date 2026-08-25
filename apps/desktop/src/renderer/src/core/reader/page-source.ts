/**
 * Page sources for the fixed-layout reading engine.
 *
 * A page source turns one unit file into addressable page images. Archive,
 * directory, and image containers already hold page entries and stream
 * straight from `book://`; PDF containers carry no images, so their pages are
 * rasterized here, in the renderer, where a canvas exists.
 *
 * Both shapes answer the same two questions the engine asks: how many pages,
 * and where page N is. Fonts come from the file itself — no CMap or standard
 * font packs are bundled, so a PDF relying on non-embedded CID fonts renders
 * with substitutes.
 */

import { buildComicFileUrl, buildComicPageUrl, buildNovelFileUrl } from '@shared/book'
import { createLogger } from '@renderer/core/log'

const log = createLogger('Reader')

/** Rasterized page width in device pixels; CSS scales the result to fit. */
const PDF_RENDER_WIDTH = 1600

/** Rendered PDF pages held in memory before the oldest are released. */
const PDF_PAGE_CACHE_SIZE = 24

export interface PageSource {
  /** Total pages, or null when the container never revealed a count. */
  readonly pageCount: number | null
  /** Displayable URL of one zero-based page. */
  getPageUrl(index: number): Promise<string>
  dispose(): void
}

/**
 * Pages served straight out of a container by the main process.
 * @param pageCount - Probed page count; null keeps the engine paging blind.
 */
export function createContainerPageSource(fileId: string, pageCount: number | null): PageSource {
  return {
    pageCount,
    getPageUrl: (index) => Promise.resolve(buildComicPageUrl(fileId, index)),
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

  const cache = new Map<number, string>()

  const release = (index: number): void => {
    const url = cache.get(index)
    if (!url) return
    URL.revokeObjectURL(url)
    cache.delete(index)
  }

  return {
    pageCount: document.numPages,

    async getPageUrl(index) {
      const cached = cache.get(index)
      if (cached) return cached

      const url = await renderPageToUrl(document, index)
      cache.set(index, url)
      // Oldest first: the engine reads forwards, so the trailing pages go.
      while (cache.size > PDF_PAGE_CACHE_SIZE) {
        release(cache.keys().next().value as number)
      }
      return url
    },

    dispose() {
      for (const url of cache.values()) URL.revokeObjectURL(url)
      cache.clear()
      void loadingTask.destroy().catch((error: unknown) => {
        log.warn('Failed to release a PDF document.', error)
      })
    }
  }
}

type PdfEngine = typeof import('pdfjs-dist')
type PdfDocument = Awaited<ReturnType<PdfEngine['getDocument']>['promise']>

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

async function renderPageToUrl(pdfDocument: PdfDocument, index: number): Promise<string> {
  const page = await pdfDocument.getPage(index + 1)
  try {
    const baseViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: PDF_RENDER_WIDTH / baseViewport.width })

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

/**
 * book:// protocol handler.
 *
 * The reading engines run in reader windows and cannot touch the disk, so this
 * protocol is their file access: comic pages by index, whole book files for
 * engines that parse the container themselves. Requests reference unit
 * file-row ids, never raw paths, so every response is confined to a path the
 * library already owns. Container parsing is delegated to media-info's book
 * engine; this handler only resolves rows and serves bytes.
 */

import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { eq } from 'drizzle-orm'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { MediaInfoService } from '@main/services/media-info'
import { comicChapterFiles, novelVolumeFiles } from '@shared/db'
import { BOOK_SCHEME } from '@shared/book'

const log = createLogger('Reader')

/** Reader windows enforce web security, so every response is CORS-readable. */
const CORS_HEADERS = { 'access-control-allow-origin': '*' } as const

export function registerBookProtocol(dbService: DbService, mediaInfo: MediaInfoService): void {
  protocol.handle(BOOK_SCHEME, async (request) => {
    try {
      return await handleBookRequest(dbService, mediaInfo, new URL(request.url))
    } catch (error) {
      log.warn('Book content request failed.', error, { url: request.url })
      return emptyResponse(404)
    }
  })
}

async function handleBookRequest(
  dbService: DbService,
  mediaInfo: MediaInfoService,
  url: URL
): Promise<Response> {
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

  switch (url.host) {
    case 'comic-page': {
      const [fileId, pageSegment] = segments
      const pageIndex = Number.parseInt(pageSegment ?? '', 10)
      if (!fileId || !Number.isInteger(pageIndex) || pageIndex < 0) {
        return emptyResponse(400)
      }

      const path = findComicFilePath(dbService, fileId)
      if (!path) return emptyResponse(404)

      const page = await mediaInfo.book.readPage(path, pageIndex)
      return new Response(new Uint8Array(page.data), {
        headers: {
          ...CORS_HEADERS,
          'content-type': page.mimeType,
          // Pages of one immutable file row never change under the same URL.
          'cache-control': 'max-age=3600'
        }
      })
    }

    case 'comic-file': {
      const [fileId] = segments
      const path = fileId ? findComicFilePath(dbService, fileId) : null
      if (!path) return emptyResponse(404)
      return fetchFileWithCors(path)
    }

    case 'novel-file': {
      const [fileId] = segments
      const path = fileId ? findNovelFilePath(dbService, fileId) : null
      if (!path) return emptyResponse(404)
      return fetchFileWithCors(path)
    }

    default:
      return emptyResponse(400)
  }
}

/** Streams a library-owned file, re-headered so the reader window may read it. */
async function fetchFileWithCors(path: string): Promise<Response> {
  const response = await net.fetch(pathToFileURL(path).toString())
  const headers = new Headers(response.headers)
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value)
  }

  return new Response(response.body, { status: response.status, headers })
}

function emptyResponse(status: number): Response {
  return new Response(null, { status, headers: CORS_HEADERS })
}

function findComicFilePath(dbService: DbService, fileId: string): string | null {
  const row = dbService.client
    .select({ path: comicChapterFiles.path })
    .from(comicChapterFiles)
    .where(eq(comicChapterFiles.id, fileId))
    .get()
  return row?.path ?? null
}

function findNovelFilePath(dbService: DbService, fileId: string): string | null {
  const row = dbService.client
    .select({ path: novelVolumeFiles.path })
    .from(novelVolumeFiles)
    .where(eq(novelVolumeFiles.id, fileId))
    .get()
  return row?.path ?? null
}

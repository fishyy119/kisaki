/**
 * book:// protocol handler.
 *
 * The reading engines run in reader windows and cannot touch the disk, so this
 * protocol is their file access: comic pages by index, whole book files for
 * engines that parse the container themselves. Requests reference unit file-row
 * ids, never raw paths, so every response is confined to a path the library
 * already owns. Resolving an id to that path belongs to the service owning
 * those rows and arrives as a resolver; this handler only serves bytes.
 */

import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { createLogger } from '@main/log'
import { BOOK_SCHEME } from '@shared/book'
import type { ReaderService } from './service'

const log = createLogger('Reader')

/** Reader windows enforce web security, so every response is CORS-readable. */
const CORS_HEADERS = { 'access-control-allow-origin': '*' } as const

/** Which unit table a `book://` request addresses. */
export type BookUnitKind = 'comic' | 'novel'

/** Stored path of one unit file row, or null when no row claims that id. */
export type BookUnitFileResolver = (kind: BookUnitKind, fileId: string) => string | null

export function registerBookProtocol(service: ReaderService): void {
  protocol.handle(BOOK_SCHEME, async (request) => {
    try {
      return await handleBookRequest(service, new URL(request.url))
    } catch (error) {
      log.warn('Book content request failed.', error, { url: request.url })
      return emptyResponse(404)
    }
  })
}

async function handleBookRequest(service: ReaderService, url: URL): Promise<Response> {
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)

  switch (url.host) {
    case 'comic-page': {
      const [fileId, pageSegment] = segments
      const pageIndex = Number.parseInt(pageSegment ?? '', 10)
      if (!fileId || !Number.isInteger(pageIndex) || pageIndex < 0) {
        return emptyResponse(400)
      }

      const path = service.findUnitFilePath('comic', fileId)
      if (!path) return emptyResponse(404)

      const page = await service.books.readPage(path, pageIndex)
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
      const path = fileId ? service.findUnitFilePath('comic', fileId) : null
      if (!path) return emptyResponse(404)
      return fetchFileWithCors(path)
    }

    case 'novel-file': {
      const [fileId] = segments
      const path = fileId ? service.findUnitFilePath('novel', fileId) : null
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

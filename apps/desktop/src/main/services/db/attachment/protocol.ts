/**
 * attachment:// protocol handler.
 *
 * Serves app-owned attachment bytes to renderer documents, optionally resized
 * through the thumbnail cache. URL segments are untrusted, so the table name is
 * validated and every resolved path is confined to the storage root before any
 * read. Successful responses opt into CORS because ambient color extraction
 * decodes covers as `crossOrigin="anonymous"` images for canvas pixel reads.
 */

import { net, protocol } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { pathExists } from '@main/utils/fs'
import { createLogger } from '@main/log'
import type { AttachmentStore } from './store'
import { requireStorageTable } from './store'
import type { ThumbnailStore } from './thumbnail'

const log = createLogger('Db')

const ATTACHMENT_SCHEME = 'attachment'

/** Image extensions the thumbnail pipeline can decode. */
const THUMBNAIL_SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.tiff',
  '.tif'
])

export interface AttachmentProtocolStores {
  attachment: AttachmentStore
  thumbnail: ThumbnailStore
}

export function registerAttachmentProtocol(stores: AttachmentProtocolStores): void {
  protocol.handle(ATTACHMENT_SCHEME, async (request) => {
    // attachment://tableName/rowId/fileName?w=240&h=320
    const url = new URL(request.url)
    const segments = url.pathname.split('/').filter(Boolean)
    if (segments.length !== 2) {
      return new Response('Invalid attachment path', { status: 400 })
    }

    const [rowId, fileName] = segments

    let fileDir: string
    let filePath: string
    try {
      const tableName = requireStorageTable(url.hostname)
      fileDir = stores.attachment.getRowDir(tableName, rowId)
      filePath = stores.attachment.getPath(tableName, rowId, fileName)
    } catch {
      return new Response('Invalid attachment path', { status: 400 })
    }

    try {
      if (!(await pathExists(filePath))) {
        return new Response('Attachment not found', { status: 404 })
      }

      const thumbnailUrl = await resolveThumbnailUrl(stores.thumbnail, url, filePath, fileDir)
      const fileUrl = thumbnailUrl ?? pathToFileURL(filePath).toString()
      return withCors(await net.fetch(fileUrl))
    } catch (error) {
      log.error('Attachment protocol failed.', error)
      return new Response('Failed to load attachment', { status: 500 })
    }
  })
}

/** Returns the thumbnail URL, or null to serve the original bytes. */
async function resolveThumbnailUrl(
  thumbnail: ThumbnailStore,
  url: URL,
  filePath: string,
  fileDir: string
): Promise<string | null> {
  const options = thumbnail.parseOptions(url.searchParams)
  if (!options || !THUMBNAIL_SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())) {
    return null
  }

  try {
    return pathToFileURL(await thumbnail.getOrCreate(filePath, fileDir, options)).toString()
  } catch (error) {
    log.warn('Thumbnail generation failed, falling back to original.', error, {
      fileName: path.basename(filePath)
    })
    return null
  }
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

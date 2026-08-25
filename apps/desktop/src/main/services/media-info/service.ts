/**
 * Media Info Service
 *
 * Technical service for reading container facts out of media files. It grows
 * by probing engine, one namespace each: `video` wraps the bundled ffprobe for
 * playable containers, `book` parses reading containers in-process (zip, rar,
 * image directories, PDF). Both are path-based and carry no domain vocabulary
 * and no database access; ingest, scanner, media-files, and the reader decide
 * what the facts mean. Main-internal: other services call it directly and
 * nothing is exposed over IPC.
 */

import { createLogger } from '@main/log'
import type { IService } from '@main/container'
import { BookInfoReader } from './book/reader'
import { VideoInfoReader } from './video/reader'

const log = createLogger('MediaInfo')

export class MediaInfoService implements IService<'media-info'> {
  readonly id = 'media-info'
  readonly deps = [] as const

  readonly video = new VideoInfoReader()
  readonly book = new BookInfoReader()

  async init(): Promise<void> {
    log.info('Initialized')
  }
}

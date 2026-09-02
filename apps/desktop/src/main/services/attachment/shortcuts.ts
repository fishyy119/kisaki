/**
 * Desktop launch shortcuts.
 *
 * Materializes an entry's launch deeplink as an OS shortcut with the entry's
 * own icon: the icon is chosen from the entry's attachments (a game's icon
 * slot, otherwise the cover), converted into the platform's icon format, cached
 * under `userData/cache/shortcut-icons/<table>/<row>`, and handed to the native
 * shortcut writer together with `kisaki://launch/<media>/<id>`. On Windows a
 * game launched from a local executable falls back to that executable's own
 * icon, which the shell reads directly.
 *
 * Every step reads attachments or writes files next to them, which is why this
 * workflow lives with the attachment service; the URL grammar belongs to the
 * deeplink contract and the launch itself to the activity service.
 */

import { app } from 'electron'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { isLinux, isWindows } from '@main/env'
import { createLogger } from '@main/log'
import type { DbService } from '@main/services/db'
import type { ImageService } from '@main/services/image'
import type { NativeService, UrlShortcutResult } from '@main/services/native'
import { animes, comics, games, novels } from '@shared/db'
import type { TableName } from '@shared/db/table-names'
import { buildLaunchDeeplinkUrl } from '@shared/deeplink'
import type { MediaType } from '@shared/entity-types'
import { resolveLauncherTarget } from './game/launcher-icon'

const log = createLogger('Attachment')

/** Where the shortcut's icon bytes come from, in preference order. */
type ShortcutIconSource =
  | { kind: 'attachment'; table: TableName; rowId: string; fileName: string }
  | { kind: 'executable'; path: string }

interface ShortcutEntry {
  name: string
  iconSources: ShortcutIconSource[]
}

type ShortcutEntryReader = (db: DbService, entityId: string) => ShortcutEntry | null

/**
 * Per-media facts: which table names the entry and which attachments may serve
 * as its icon. Games prefer their dedicated icon slot and can fall back to the
 * launcher executable; every other media type uses its cover.
 */
const SHORTCUT_ENTRY_READERS: Record<MediaType, ShortcutEntryReader> = {
  game: (db, entityId) => {
    const row = db.client.select().from(games).where(eq(games.id, entityId)).get()
    if (!row) return null
    const sources: ShortcutIconSource[] = []
    if (row.iconFile) {
      sources.push({ kind: 'attachment', table: 'games', rowId: row.id, fileName: row.iconFile })
    }
    const launcherTarget = resolveLauncherTarget(row)
    if (launcherTarget && /\.(exe|ico)$/i.test(launcherTarget)) {
      sources.push({ kind: 'executable', path: launcherTarget })
    }
    if (row.coverFile) {
      sources.push({ kind: 'attachment', table: 'games', rowId: row.id, fileName: row.coverFile })
    }
    return { name: row.name, iconSources: sources }
  },
  anime: (db, entityId) => {
    const row = db.client.select().from(animes).where(eq(animes.id, entityId)).get()
    if (!row) return null
    return { name: row.name, iconSources: coverSource('animes', row.id, row.coverFile) }
  },
  comic: (db, entityId) => {
    const row = db.client.select().from(comics).where(eq(comics.id, entityId)).get()
    if (!row) return null
    return { name: row.name, iconSources: coverSource('comics', row.id, row.coverFile) }
  },
  novel: (db, entityId) => {
    const row = db.client.select().from(novels).where(eq(novels.id, entityId)).get()
    if (!row) return null
    return { name: row.name, iconSources: coverSource('novels', row.id, row.coverFile) }
  }
}

function coverSource(
  table: TableName,
  rowId: string,
  coverFile: string | null
): ShortcutIconSource[] {
  return coverFile ? [{ kind: 'attachment', table, rowId, fileName: coverFile }] : []
}

export interface AttachmentShortcutsDeps {
  db: DbService
  image: ImageService
  native: NativeService
}

export class AttachmentShortcuts {
  private readonly cacheDir = path.join(app.getPath('userData'), 'cache', 'shortcut-icons')

  constructor(private readonly deps: AttachmentShortcutsDeps) {}

  async createLaunchShortcut(mediaType: MediaType, entityId: string): Promise<UrlShortcutResult> {
    const entry = SHORTCUT_ENTRY_READERS[mediaType](this.deps.db, entityId)
    if (!entry) {
      throw new Error(`Entry not found: ${mediaType}:${entityId}`)
    }

    const iconPath = await this.resolveIconPath(entry.iconSources)
    const result = await this.deps.native.shortcuts.createUrlShortcut({
      location: 'desktop',
      baseName: entry.name,
      url: buildLaunchDeeplinkUrl(mediaType, entityId),
      ...(iconPath ? { iconPath } : {})
    })

    log.info('Launch shortcut created.', { mediaType, entityId, iconApplied: result.iconApplied })
    return result
  }

  /** Drops the cached icon of a deleted row; the shortcut file itself is the user's. */
  async onRowDeleted(table: TableName, rowId: string): Promise<void> {
    await rm(path.join(this.cacheDir, table, rowId), { recursive: true, force: true })
  }

  /**
   * Walks the icon sources until one yields a platform icon file. Attachments
   * are converted and cached; a Windows executable is referenced in place. The
   * application's own executable is the final fallback where the platform can
   * read an icon out of it.
   */
  private async resolveIconPath(sources: ShortcutIconSource[]): Promise<string | undefined> {
    for (const source of sources) {
      try {
        const resolved = await this.materializeIcon(source)
        if (resolved) return resolved
      } catch (error) {
        log.warn('Shortcut icon source failed, trying the next one.', error, {
          sourceKind: source.kind
        })
      }
    }
    return isWindows ? process.execPath : undefined
  }

  private async materializeIcon(source: ShortcutIconSource): Promise<string | undefined> {
    if (source.kind === 'executable') {
      return isWindows ? source.path : undefined
    }

    const attachmentPath = this.deps.db.attachment.getPath(
      source.table,
      source.rowId,
      source.fileName
    )
    const input = { kind: 'path', path: attachmentPath } as const

    if (isWindows) {
      return this.writeCachedIcon(source, 'ico', await this.deps.image.icons.toIco(input))
    }
    if (isLinux) {
      return this.writeCachedIcon(source, 'png', await this.deps.image.icons.toPngIcon(input))
    }
    return undefined
  }

  private async writeCachedIcon(
    source: Extract<ShortcutIconSource, { kind: 'attachment' }>,
    extension: 'ico' | 'png',
    bytes: Buffer
  ): Promise<string> {
    const dir = path.join(this.cacheDir, source.table, source.rowId)
    await mkdir(dir, { recursive: true })
    const iconPath = path.join(dir, `launch.${extension}`)
    await writeFile(iconPath, bytes)
    return iconPath
  }
}

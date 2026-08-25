/**
 * Reader window management.
 *
 * One window per library entry: opening the same entry focuses the existing
 * window, opening another entry creates a sibling. Each window's prepared
 * bootstrap is held here and served over `reader:bootstrap`, keyed by the
 * requesting webContents, so a window can only read the payload prepared for
 * it.
 */

import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import { isDev, rendererDevServerUrl } from '@main/env'
import { createLogger } from '@main/log'
import type { ReaderBootstrap } from '@shared/reader'
import type { ReaderHooks } from './hooks'

const log = createLogger('Reader')

interface ReaderWindowRecord {
  window: BrowserWindow
  /** Stable entry key (`comic:<id>` / `novel:<id>`) the window was opened for. */
  entryKey: string
  bootstrap: ReaderBootstrap
}

export class ReaderWindowManager {
  private readonly records = new Map<number, ReaderWindowRecord>()

  constructor(private readonly hooks: ReaderHooks) {}

  /**
   * Opens a reader window for the prepared bootstrap, or refocuses the entry's
   * existing window. Refocusing replaces the stored bootstrap so a re-request
   * from a reloaded window starts at the freshly resolved unit.
   */
  open(entryKey: string, bootstrap: ReaderBootstrap): number {
    const existing = this.findByEntryKey(entryKey)
    if (existing) {
      existing.bootstrap = bootstrap
      if (existing.window.isMinimized()) existing.window.restore()
      existing.window.focus()
      return existing.window.id
    }

    const window = new BrowserWindow({
      width: 1200,
      height: 860,
      minWidth: 480,
      minHeight: 360,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#0a0a0a',
      title: bootstrap.title,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/index.mjs'),
        sandbox: false,
        webSecurity: false
      }
    })

    this.records.set(window.id, { window, entryKey, bootstrap })

    window.on('ready-to-show', () => {
      window.show()
    })

    window.on('closed', () => {
      const windowId = window.id
      if (this.records.delete(windowId)) {
        this.hooks.windowClosed.dispatch({ windowId })
      }
    })

    // The document title carries reading position; the window keeps the entry name.
    window.webContents.on('page-title-updated', (event) => {
      event.preventDefault()
    })

    if (isDev && rendererDevServerUrl) {
      const base = rendererDevServerUrl
      const url = new URL('reader.html', base.endsWith('/') ? base : `${base}/`).toString()
      window.loadURL(url).catch((error) => {
        log.error('Failed to load reader window URL.', error)
      })
    } else {
      window.loadFile(join(import.meta.dirname, '../renderer/reader.html')).catch((error) => {
        log.error('Failed to load reader window file.', error)
      })
    }

    log.info('Reader window opened.', { entryKey, windowId: window.id })
    return window.id
  }

  /** Bootstrap prepared for this window; null for non-reader webContents. */
  getBootstrap(windowId: number): ReaderBootstrap | null {
    return this.records.get(windowId)?.bootstrap ?? null
  }

  isReaderWindow(windowId: number): boolean {
    return this.records.has(windowId)
  }

  close(windowId: number): void {
    const record = this.records.get(windowId)
    if (record && !record.window.isDestroyed()) {
      record.window.close()
    }
  }

  dispose(): void {
    for (const record of this.records.values()) {
      if (!record.window.isDestroyed()) {
        record.window.destroy()
      }
    }
    this.records.clear()
  }

  private findByEntryKey(entryKey: string): ReaderWindowRecord | undefined {
    for (const record of this.records.values()) {
      if (record.entryKey === entryKey && !record.window.isDestroyed()) {
        return record
      }
    }
    return undefined
  }
}

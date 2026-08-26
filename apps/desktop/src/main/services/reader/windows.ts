/**
 * Reader window management.
 *
 * One window per library entry: opening the same entry re-aims the existing
 * window, opening another entry creates a sibling. Each window's prepared
 * bootstrap is held here and served over `reader:bootstrap`, keyed by the
 * requesting webContents, so a window can only read the payload prepared for
 * it.
 *
 * Reader windows are the only surface that lays out files the user obtained
 * elsewhere, so they run with web security on, a reader-only preload, and no
 * way to navigate away from the reader document.
 */

import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import windowStateKeeper from 'electron-window-state'
import { isDev, rendererDevServerUrl } from '@main/env'
import { createLogger } from '@main/log'
import type { ReaderBootstrap } from '@shared/reader'
import type { ReaderHooks } from './hooks'

const log = createLogger('Reader')

const WINDOW_STATE_FILE = 'reader-window-state.json'

interface ReaderWindowRecord {
  window: BrowserWindow
  /** Stable entry key (`comic:<id>` / `novel:<id>`) the window was opened for. */
  entryKey: string
  bootstrap: ReaderBootstrap
}

/** Outcome of a read request: a fresh window, or one that was re-aimed. */
export interface ReaderWindowOpenResult {
  windowId: number
  reused: boolean
}

export class ReaderWindowManager {
  private readonly records = new Map<number, ReaderWindowRecord>()

  constructor(private readonly hooks: ReaderHooks) {}

  /**
   * Opens a reader window for the prepared bootstrap, or re-aims the entry's
   * existing window. Re-aiming replaces the stored bootstrap and pushes it, so
   * the window moves to the freshly resolved unit instead of silently ignoring
   * the request.
   */
  open(entryKey: string, bootstrap: ReaderBootstrap): ReaderWindowOpenResult {
    const existing = this.findByEntryKey(entryKey)
    if (existing) {
      existing.bootstrap = bootstrap
      if (existing.window.isMinimized()) existing.window.restore()
      existing.window.focus()
      existing.window.webContents.send('reader:navigate', bootstrap)
      return { windowId: existing.window.id, reused: true }
    }

    // Only the first reader window restores and records the remembered place;
    // siblings take the remembered size and let the platform place them.
    const isFirstWindow = this.records.size === 0
    const windowState = windowStateKeeper({
      defaultWidth: 1200,
      defaultHeight: 860,
      maximize: false,
      fullScreen: false,
      file: WINDOW_STATE_FILE
    })

    const window = new BrowserWindow({
      ...(isFirstWindow ? { x: windowState.x, y: windowState.y } : {}),
      width: windowState.width,
      height: windowState.height,
      minWidth: 480,
      minHeight: 360,
      show: false,
      autoHideMenuBar: true,
      title: bootstrap.title,
      webPreferences: {
        preload: join(import.meta.dirname, '../preload/reader.mjs'),
        sandbox: false
      }
    })

    if (isFirstWindow) windowState.manage(window)
    this.records.set(window.id, { window, entryKey, bootstrap })

    window.on('ready-to-show', () => {
      window.show()
    })

    // Full screen is the reader's own chrome-free reading mode, and the platform
    // can enter or leave it without us asking, so the window state is pushed
    // rather than assumed by whoever requested the change.
    window.on('enter-full-screen', () => {
      window.webContents.send('reader:fullscreen-changed', true)
    })

    window.on('leave-full-screen', () => {
      window.webContents.send('reader:fullscreen-changed', false)
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

    this.confineToReaderDocument(window)

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
    return { windowId: window.id, reused: false }
  }

  /** Bootstrap prepared for this window; null for non-reader webContents. */
  getBootstrap(windowId: number): ReaderBootstrap | null {
    return this.records.get(windowId)?.bootstrap ?? null
  }

  isReaderWindow(windowId: number): boolean {
    return this.records.has(windowId)
  }

  setFullScreen(windowId: number, fullScreen: boolean): void {
    const record = this.records.get(windowId)
    if (record && !record.window.isDestroyed()) {
      record.window.setFullScreen(fullScreen)
    }
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

  /**
   * Book content must never move the window off the reader document: link
   * clicks inside a book open nothing, and no navigation replaces the app.
   */
  private confineToReaderDocument(window: BrowserWindow): void {
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

    window.webContents.on('will-navigate', (event, url) => {
      if (url === window.webContents.getURL()) return
      event.preventDefault()
      log.warn('Blocked navigation inside a reader window.', { windowId: window.id })
    })
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

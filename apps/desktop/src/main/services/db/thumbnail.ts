/**
 * Thumbnail Store
 *
 * Handles thumbnail generation and caching with mutex protection.
 */

import { Mutex } from 'async-mutex'
import sharp from 'sharp'
import smartcrop from 'smartcrop-sharp'
import { readdir, rm } from 'node:fs/promises'
import { pathExists } from '@main/utils/fs'
import path from 'node:path'
import { createLogger } from '@main/log'
import type { ThumbnailFit, ThumbnailOptions } from './types'

const log = createLogger('Db')

/** Guards against absurd allocations from a crafted `attachment://` URL. */
const MAX_THUMBNAIL_DIMENSION = 4096

function parseDimension(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_THUMBNAIL_DIMENSION) {
    return undefined
  }
  return parsed
}

/**
 * Thumbnail generation and caching manager.
 * Generates WebP thumbnails with various resize modes including smart crop.
 */
export class ThumbnailStore {
  private mutexMap = new Map<string, Mutex>()
  private cleanerInterval?: ReturnType<typeof setInterval>

  constructor() {
    this.startMutexCleaner()
  }

  /**
   * Get existing thumbnail or create new one.
   * Thumbnails are cached on disk and reused for subsequent requests.
   */
  async getOrCreate(
    originalPath: string,
    thumbnailDir: string,
    options: ThumbnailOptions
  ): Promise<string> {
    if (!options.width && !options.height) {
      throw new Error('Thumbnail options must specify at least width or height')
    }

    const originalFileName = path.basename(originalPath)
    const thumbnailFileName = this.getFileName(originalFileName, options)
    const thumbnailPath = path.join(thumbnailDir, thumbnailFileName)

    const existingMutex = this.mutexMap.get(thumbnailPath)
    if (!existingMutex || !existingMutex.isLocked()) {
      if (await pathExists(thumbnailPath)) {
        return thumbnailPath
      }
    }

    const mutex = this.getMutex(thumbnailPath)

    return await mutex.runExclusive(async () => {
      if (await pathExists(thumbnailPath)) {
        return thumbnailPath
      }

      if (!(await pathExists(originalPath))) {
        throw new Error(`Original file not found: ${originalPath}`)
      }

      try {
        const fit = options.fit ?? 'cover'

        if (fit === 'smart') {
          await this.generateSmartCrop(originalPath, thumbnailPath, options)
        } else {
          await sharp(originalPath)
            .resize({
              width: options.width,
              height: options.height,
              fit: fit,
              withoutEnlargement: true
            })
            .webp({ quality: options.quality ?? 100 })
            .toFile(thumbnailPath)
        }

        log.debug('Generated thumbnail.', { thumbnailPath: thumbnailPath })
        return thumbnailPath
      } catch (error) {
        log.error('Failed to generate thumbnail.', error, { originalPath: originalPath })
        throw new Error('Failed to generate thumbnail.', { cause: error })
      }
    })
  }

  /**
   * Delete all thumbnails for an original file.
   */
  async delete(originalPath: string, thumbnailDir: string): Promise<void> {
    const originalFileName = path.basename(originalPath)
    const ext = path.extname(originalFileName)
    const baseName = path.basename(originalFileName, ext)

    try {
      const files = await readdir(thumbnailDir)
      const thumbnailPattern = new RegExp(
        `^${this.escapeRegex(baseName)}_\\d+x\\d+_(cover|contain|fill|inside|outside|smart)\\.webp$`
      )

      for (const file of files) {
        if (thumbnailPattern.test(file)) {
          const filePath = path.join(thumbnailDir, file)
          await rm(filePath, { recursive: true, force: true })
          log.debug('Deleted thumbnail.', { filePath: filePath })
        }
      }
    } catch (error) {
      log.warn('Failed to delete thumbnails.', error, { originalPath: originalPath })
    }
  }

  /**
   * Parse thumbnail options from untrusted URL search params.
   * Out-of-range or non-numeric dimensions are ignored rather than clamped, so
   * a malformed request falls back to the original file instead of rendering an
   * unrelated size. Returns null when no usable dimension is requested.
   */
  parseOptions(searchParams: URLSearchParams): ThumbnailOptions | null {
    const width = parseDimension(searchParams.get('w') ?? searchParams.get('width'))
    const height = parseDimension(searchParams.get('h') ?? searchParams.get('height'))

    if (width === undefined && height === undefined) return null

    const options: ThumbnailOptions = {}
    if (width !== undefined) options.width = width
    if (height !== undefined) options.height = height

    const fit = searchParams.get('fit') as ThumbnailFit
    if (fit && ['cover', 'contain', 'fill', 'inside', 'outside', 'smart'].includes(fit)) {
      options.fit = fit
    }

    const quality = parseInt(searchParams.get('q') ?? searchParams.get('quality') ?? '', 10)
    if (Number.isFinite(quality)) {
      options.quality = Math.min(100, Math.max(1, quality))
    }

    return options
  }

  /**
   * Generate thumbnail filename based on options.
   */
  getFileName(originalFileName: string, options: ThumbnailOptions): string {
    const ext = path.extname(originalFileName)
    const baseName = path.basename(originalFileName, ext)
    const width = options.width ?? 0
    const height = options.height ?? 0
    const fit = options.fit ?? 'cover'
    return `${baseName}_${width}x${height}_${fit}.webp`
  }

  /**
   * Cleanup resources.
   */
  dispose(): void {
    if (this.cleanerInterval) {
      clearInterval(this.cleanerInterval)
    }
    this.mutexMap.clear()
  }

  private getMutex(key: string): Mutex {
    if (!this.mutexMap.has(key)) {
      this.mutexMap.set(key, new Mutex())
    }
    return this.mutexMap.get(key)!
  }

  private async generateSmartCrop(
    originalPath: string,
    thumbnailPath: string,
    options: ThumbnailOptions
  ): Promise<void> {
    const width = options.width ?? 240
    const height = options.height ?? 320

    const result = await smartcrop.crop(originalPath, { width, height })
    const crop = result.topCrop

    await sharp(originalPath)
      .extract({
        left: crop.x,
        top: crop.y,
        width: crop.width,
        height: crop.height
      })
      .resize(width, height)
      .webp({ quality: options.quality ?? 100 })
      .toFile(thumbnailPath)
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  private startMutexCleaner(): void {
    const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour

    this.cleanerInterval = setInterval(() => {
      const keysToDelete: string[] = []

      this.mutexMap.forEach((mutex, key) => {
        if (!mutex.isLocked()) {
          keysToDelete.push(key)
        }
      })

      keysToDelete.forEach((key) => {
        this.mutexMap.delete(key)
      })

      if (keysToDelete.length > 0) {
        log.debug('Cleaned up unused mutexes.', { keysToDeleteLength: keysToDelete.length })
      }
    }, CLEANUP_INTERVAL)
  }
}

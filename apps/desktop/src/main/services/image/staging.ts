/**
 * Image staging: transforms applied to a not-yet-imported image while the user
 * is still picking it — a crop written to a temp file the attachment store can
 * import, and a downscaled preview for the form.
 */

import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import type { Stats } from 'node:fs'
import path from 'node:path'
import sharp, { type Metadata, type Sharp } from 'sharp'
import { pathExists } from '@main/utils/fs'
import { newId } from '@shared/id'
import type { CropRegion } from '@shared/attachment'
import type { AttachmentInput } from '@shared/db/contracts/attachment'

export type CropToTempFormat = 'keep' | 'png' | 'jpeg' | 'webp'

export interface CropToTempOptions {
  format?: CropToTempFormat
  quality?: number
}

export interface ImageStagingDeps {
  tempDir: string
  downloadBuffer: (url: string) => Promise<Buffer>
}

/** Preview width; enough for form thumbnails while keeping the data URL small. */
const PREVIEW_MAX_WIDTH = 640

export class ImageStaging {
  constructor(private readonly deps: ImageStagingDeps) {}

  async cleanupOldTemp(ttlMs: number): Promise<void> {
    const { tempDir } = this.deps
    if (!(await pathExists(tempDir))) return

    const now = Date.now()
    const entries = await readdir(tempDir, { withFileTypes: true })
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isFile()) return
        const filePath = path.join(tempDir, entry.name)
        try {
          const fileStat = await stat(filePath)
          if (now - fileStat.mtimeMs > ttlMs) {
            await rm(filePath, { recursive: true, force: true })
          }
        } catch {
          // Best-effort cleanup
        }
      })
    )
  }

  async cropToTemp(
    input: AttachmentInput,
    cropRegion: CropRegion,
    options?: CropToTempOptions
  ): Promise<string> {
    const resolved = await resolveSharpInput(input, this.deps.downloadBuffer)
    const metadata = await sharp(resolved).metadata()
    const { width, height } = getEffectiveDimensions(metadata)

    if (!width || !height) {
      throw new Error('Failed to read image dimensions')
    }

    const crop = normalizeCropRegion(cropRegion, width, height)

    const requestedFormat = options?.format ?? 'keep'
    const { ext, applyFormat } = getOutputFormat(requestedFormat, metadata.format, options?.quality)

    const outputDir = this.deps.tempDir
    await mkdir(outputDir, { recursive: true })

    const outputPath = path.join(outputDir, `${newId()}${ext}`)

    const pipeline = sharp(resolved).rotate().extract({
      left: crop.left,
      top: crop.top,
      width: crop.width,
      height: crop.height
    })

    await applyFormat(pipeline).toFile(outputPath)
    return outputPath
  }

  /** Downscaled data URL of a source image, for staged form previews. */
  async readPreviewDataUrl(input: AttachmentInput): Promise<string> {
    const resolved = await resolveSharpInput(input, this.deps.downloadBuffer)
    const buffer = await sharp(resolved)
      .rotate()
      .resize({ width: PREVIEW_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    return `data:image/webp;base64,${buffer.toString('base64')}`
  }
}

/** Resolves an attachment input to something sharp can open. */
export async function resolveSharpInput(
  input: AttachmentInput,
  downloadBuffer: (url: string) => Promise<Buffer>
): Promise<string | Buffer> {
  switch (input.kind) {
    case 'buffer':
      return Buffer.from(input.buffer)
    case 'path': {
      const rawPath = input.path
      const filePath = path.isAbsolute(rawPath) ? rawPath : path.resolve(rawPath)
      let fileStat: Stats
      try {
        fileStat = await stat(filePath)
      } catch {
        throw new Error(`Source file not found: ${filePath}`)
      }
      if (!fileStat.isFile()) {
        throw new Error(`Source path is not a file: ${filePath}`)
      }
      return filePath
    }
    case 'url':
      return await downloadBuffer(input.url)
  }
}

function getEffectiveDimensions(metadata: Metadata): { width: number; height: number } {
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  const orientation = metadata.orientation

  if (orientation && [5, 6, 7, 8].includes(orientation)) {
    return { width: height, height: width }
  }

  return { width, height }
}

function normalizeCropRegion(
  cropRegion: CropRegion,
  imageWidth: number,
  imageHeight: number
): { left: number; top: number; width: number; height: number } {
  const x = Number(cropRegion.x)
  const y = Number(cropRegion.y)
  const w = Number(cropRegion.width)
  const h = Number(cropRegion.height)

  if (![x, y, w, h].every((v) => Number.isFinite(v))) {
    throw new Error('Invalid crop region')
  }
  if (w <= 0 || h <= 0) {
    throw new Error('Invalid crop region size')
  }

  let left = Math.round(x)
  let top = Math.round(y)
  let width = Math.round(w)
  let height = Math.round(h)

  left = Math.max(0, Math.min(left, imageWidth - 1))
  top = Math.max(0, Math.min(top, imageHeight - 1))

  width = Math.max(1, Math.min(width, imageWidth - left))
  height = Math.max(1, Math.min(height, imageHeight - top))

  return { left, top, width, height }
}

function getOutputFormat(
  requested: CropToTempFormat,
  sourceFormat: string | undefined,
  quality: number | undefined
): { ext: string; applyFormat: (pipeline: Sharp) => Sharp } {
  const q = typeof quality === 'number' ? Math.min(100, Math.max(1, Math.round(quality))) : 90

  const normalizeSource = (fmt: string | undefined) => {
    if (!fmt) return undefined
    if (fmt === 'jpg') return 'jpeg'
    return fmt
  }

  const fmt =
    requested === 'keep'
      ? (normalizeSource(sourceFormat) as 'png' | 'jpeg' | 'webp' | undefined)
      : requested

  if (fmt === 'png') {
    return { ext: '.png', applyFormat: (p) => p.png() }
  }
  if (fmt === 'jpeg') {
    return { ext: '.jpg', applyFormat: (p) => p.jpeg({ quality: q }) }
  }
  if (fmt === 'webp') {
    return { ext: '.webp', applyFormat: (p) => p.webp({ quality: q }) }
  }

  return { ext: '.webp', applyFormat: (p) => p.webp({ quality: q }) }
}

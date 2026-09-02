/**
 * Icon encoding: turns any image into a Windows `.ico` container holding
 * PNG-compressed frames at the sizes the shell asks for (PNG-in-ICO is native
 * since Vista, so no BMP frames are needed).
 */

import sharp from 'sharp'
import type { AttachmentInput } from '@shared/db/contracts/attachment'
import { resolveSharpInput } from './staging'

/** Frame sizes the Windows shell samples for desktop, list, and taskbar views. */
const ICO_FRAME_SIZES = [16, 32, 48, 256] as const

const ICONDIR_BYTES = 6
const ICONDIRENTRY_BYTES = 16

export interface ImageIconsDeps {
  downloadBuffer: (url: string) => Promise<Buffer>
}

/** Largest single-frame icon size freedesktop themes commonly index. */
const PNG_ICON_SIZE = 256

export class ImageIcons {
  constructor(private readonly deps: ImageIconsDeps) {}

  /** Encodes the image as a multi-frame ICO, center-cropped to a square. */
  async toIco(input: AttachmentInput): Promise<Buffer> {
    const resolved = await resolveSharpInput(input, this.deps.downloadBuffer)
    const frames = await Promise.all(
      ICO_FRAME_SIZES.map((size) =>
        sharp(resolved)
          .rotate()
          .resize(size, size, { fit: 'cover', position: 'centre' })
          .ensureAlpha()
          .png()
          .toBuffer()
      )
    )
    return encodeIco(frames.map((png, index) => ({ png, size: ICO_FRAME_SIZES[index]! })))
  }

  /** Encodes the image as one square PNG frame, for platforms that take PNG icons. */
  async toPngIcon(input: AttachmentInput): Promise<Buffer> {
    const resolved = await resolveSharpInput(input, this.deps.downloadBuffer)
    return sharp(resolved)
      .rotate()
      .resize(PNG_ICON_SIZE, PNG_ICON_SIZE, { fit: 'cover', position: 'centre' })
      .ensureAlpha()
      .png()
      .toBuffer()
  }
}

interface IcoFrame {
  png: Buffer
  size: number
}

function encodeIco(frames: IcoFrame[]): Buffer {
  const header = Buffer.alloc(ICONDIR_BYTES + ICONDIRENTRY_BYTES * frames.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(frames.length, 4)

  let offset = header.length
  frames.forEach((frame, index) => {
    const entry = ICONDIR_BYTES + ICONDIRENTRY_BYTES * index
    // A 256px frame is encoded as 0 in the one-byte width/height fields.
    const dimension = frame.size >= 256 ? 0 : frame.size
    header.writeUInt8(dimension, entry)
    header.writeUInt8(dimension, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(frame.png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += frame.png.length
  })

  return Buffer.concat([header, ...frames.map((frame) => frame.png)])
}

/**
 * Perceptual hash (pHash) algorithm, version 1.
 *
 * Pipeline: decode PNG -> composite alpha over black -> BT.601 luma ->
 * 32x32 area-average resample -> 2D DCT-II -> 8x8 low-frequency block
 * (frequencies 1..8 on both axes, DC row/column excluded) -> mean threshold
 * -> 64-bit hash, most significant bit first in (fy, fx) scan order.
 *
 * The index database stores hashes produced by this exact pipeline and the
 * algorithm version participates in the index meta handshake. Any change to
 * this module that alters produced bits must bump PHASH_ALGORITHM_VERSION
 * and regenerate the index.
 */

import { PNG } from 'pngjs'

export const PHASH_ALGORITHM_VERSION = 1

export const PHASH_BYTE_LENGTH = 8

const SAMPLE_SIZE = 32
const BLOCK_SIZE = 8

/**
 * Computes the 64-bit perceptual hash of a PNG image.
 * @remarks Images with no luminance structure (fully flat after compositing)
 * hash to `0n`; callers should treat that value as "no usable signature".
 */
export function computePhashFromPng(png: Uint8Array): bigint {
  const decoded = PNG.sync.read(toBuffer(png))
  const luma = toCompositedLuma(decoded.data, decoded.width * decoded.height)
  const sampled = resampleArea(luma, decoded.width, decoded.height)
  const block = dctLowFrequencyBlock(sampled)
  return hashFromBlock(block)
}

export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b
  let distance = 0
  while (xor > 0n) {
    xor &= xor - 1n
    distance += 1
  }
  return distance
}

/** Serializes a hash as 8 big-endian bytes for index storage. */
export function phashToBytes(hash: bigint): Uint8Array {
  const bytes = new Uint8Array(PHASH_BYTE_LENGTH)
  new DataView(bytes.buffer).setBigUint64(0, BigInt.asUintN(64, hash), false)
  return bytes
}

/** Reads a hash from its 8-byte big-endian index representation. */
export function phashFromBytes(bytes: Uint8Array): bigint {
  if (bytes.byteLength !== PHASH_BYTE_LENGTH) {
    throw new Error(`A pHash value must be exactly ${PHASH_BYTE_LENGTH} bytes.`)
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(0, false)
}

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.isBuffer(bytes)
    ? bytes
    : Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

/** RGBA pixels -> BT.601 luma composited over black (alpha-weighted). */
function toCompositedLuma(rgba: Uint8Array, pixelCount: number): Float64Array {
  const luma = new Float64Array(pixelCount)
  for (let i = 0; i < pixelCount; i += 1) {
    const offset = i * 4
    const alpha = rgba[offset + 3]! / 255
    luma[i] =
      (0.299 * rgba[offset]! + 0.587 * rgba[offset + 1]! + 0.114 * rgba[offset + 2]!) * alpha
  }
  return luma
}

/** Area-average (box) resample to SAMPLE_SIZE x SAMPLE_SIZE. */
function resampleArea(src: Float64Array, width: number, height: number): Float64Array {
  const out = new Float64Array(SAMPLE_SIZE * SAMPLE_SIZE)
  const scaleX = width / SAMPLE_SIZE
  const scaleY = height / SAMPLE_SIZE

  for (let ty = 0; ty < SAMPLE_SIZE; ty += 1) {
    const y0 = ty * scaleY
    const y1 = y0 + scaleY
    for (let tx = 0; tx < SAMPLE_SIZE; tx += 1) {
      const x0 = tx * scaleX
      const x1 = x0 + scaleX
      let sum = 0
      let weight = 0

      for (let sy = Math.floor(y0); sy < y1 && sy < height; sy += 1) {
        const weightY = Math.min(sy + 1, y1) - Math.max(sy, y0)
        if (weightY <= 0) continue
        for (let sx = Math.floor(x0); sx < x1 && sx < width; sx += 1) {
          const weightX = Math.min(sx + 1, x1) - Math.max(sx, x0)
          if (weightX <= 0) continue
          const w = weightX * weightY
          sum += src[sy * width + sx]! * w
          weight += w
        }
      }

      out[ty * SAMPLE_SIZE + tx] = weight > 0 ? sum / weight : 0
    }
  }

  return out
}

/** cosTable[f * SAMPLE_SIZE + i] = cos((2i + 1) * (f + 1) * PI / (2 * SAMPLE_SIZE)) */
const COS_TABLE = createCosTable()

function createCosTable(): Float64Array {
  const table = new Float64Array(BLOCK_SIZE * SAMPLE_SIZE)
  for (let f = 0; f < BLOCK_SIZE; f += 1) {
    for (let i = 0; i < SAMPLE_SIZE; i += 1) {
      table[f * SAMPLE_SIZE + i] = Math.cos(((2 * i + 1) * (f + 1) * Math.PI) / (2 * SAMPLE_SIZE))
    }
  }
  return table
}

/**
 * Separable DCT-II restricted to the frequencies the hash consumes
 * (1..BLOCK_SIZE on both axes). Uniform scaling factors are omitted because
 * the hash thresholds against the block mean.
 */
function dctLowFrequencyBlock(values: Float64Array): Float64Array {
  const rowPass = new Float64Array(SAMPLE_SIZE * BLOCK_SIZE)
  for (let y = 0; y < SAMPLE_SIZE; y += 1) {
    for (let fx = 0; fx < BLOCK_SIZE; fx += 1) {
      let sum = 0
      for (let x = 0; x < SAMPLE_SIZE; x += 1) {
        sum += values[y * SAMPLE_SIZE + x]! * COS_TABLE[fx * SAMPLE_SIZE + x]!
      }
      rowPass[y * BLOCK_SIZE + fx] = sum
    }
  }

  const block = new Float64Array(BLOCK_SIZE * BLOCK_SIZE)
  for (let fy = 0; fy < BLOCK_SIZE; fy += 1) {
    for (let fx = 0; fx < BLOCK_SIZE; fx += 1) {
      let sum = 0
      for (let y = 0; y < SAMPLE_SIZE; y += 1) {
        sum += rowPass[y * BLOCK_SIZE + fx]! * COS_TABLE[fy * SAMPLE_SIZE + y]!
      }
      block[fy * BLOCK_SIZE + fx] = sum
    }
  }

  return block
}

function hashFromBlock(block: Float64Array): bigint {
  let mean = 0
  for (let i = 0; i < block.length; i += 1) {
    mean += block[i]!
  }
  mean /= block.length

  let hash = 0n
  for (let i = 0; i < block.length; i += 1) {
    hash = (hash << 1n) | (block[i]! > mean ? 1n : 0n)
  }
  return hash
}

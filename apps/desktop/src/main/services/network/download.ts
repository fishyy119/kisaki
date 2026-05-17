import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import fse from 'fs-extra'
import type { FetchOptions } from '@shared/network'
import type { NetworkRequestClient } from './request'
import { assertNotAborted, DEFAULT_NETWORK_RETRY_COUNT, executeWithNetworkRetry } from './shared'

export interface NetworkDownloaderOptions {
  request: NetworkRequestClient
}

export class NetworkDownloader {
  constructor(private readonly options: NetworkDownloaderOptions) {}

  /**
   * Download content as Buffer.
   */
  async buffer(url: string, options: FetchOptions = {}): Promise<Buffer> {
    const response = await this.options.request.fetch(url, options)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * Download content to a file via streaming.
   */
  async toFile(url: string, destPath: string, options: FetchOptions = {}): Promise<void> {
    const retries = options.retries ?? DEFAULT_NETWORK_RETRY_COUNT
    const attemptOptions: FetchOptions = { ...options, retries: 0 }
    const tempPath = path.join(
      path.dirname(destPath),
      `.${path.basename(destPath)}.${randomUUID()}.tmp`
    )

    await executeWithNetworkRetry(
      async () => {
        assertNotAborted(options.signal)
        await fse.ensureDir(path.dirname(destPath))
        await fse.remove(tempPath).catch(() => undefined)

        const response = await this.options.request.fetch(url, attemptOptions)
        if (!response.ok) {
          throw new Error(`Download failed: ${response.status} ${response.statusText}`)
        }
        if (!response.body) {
          throw new Error('Download failed: empty response body')
        }

        const bodyStream = Readable.fromWeb(response.body as any)
        const fileStream = createWriteStream(tempPath)
        const maxBytes = normalizeMaxBytes(options.maxBytes)
        const streams = maxBytes
          ? [bodyStream, createByteLimitTransform(maxBytes), fileStream]
          : [bodyStream, fileStream]

        try {
          await pipeline(streams, {
            signal: options.signal
          })
          assertNotAborted(options.signal)
          await fse.move(tempPath, destPath, { overwrite: true })
        } catch (error) {
          await fse.remove(tempPath).catch(() => undefined)
          throw error
        }
      },
      {
        retries,
        signal: options.signal,
        shouldRetry: (error) => !isByteLimitExceededError(error)
      }
    )
  }
}

function isByteLimitExceededError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'ByteLimitExceededError'
}

function normalizeMaxBytes(value: number | undefined): number | null {
  if (value === undefined) {
    return null
  }

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Download maxBytes must be a positive safe integer.')
  }

  return value
}

function createByteLimitTransform(maxBytes: number): Transform {
  let received = 0

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.byteLength
      if (received > maxBytes) {
        callback(createByteLimitExceededError(received, maxBytes))
        return
      }

      callback(null, chunk)
    }
  })
}

function createByteLimitExceededError(received: number, maxBytes: number): Error {
  const error = new Error(`Download exceeded the maximum allowed size: ${received} > ${maxBytes}.`)
  error.name = 'ByteLimitExceededError'
  return error
}

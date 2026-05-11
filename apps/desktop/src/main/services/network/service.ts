/**
 * Network Service
 *
 * Unified network layer for the main process with:
 * - Timeout and retry with exponential backoff
 * - Domain-based rate limiting (caller-registered)
 * - Extension-accessible API
 */

import { net, session } from 'electron'
import log from 'electron-log/main'
import { createWriteStream } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import fse from 'fs-extra'
import type { IService, ServiceInitContainer, ServiceName } from '@main/container'
import type { FetchOptions, RateLimitConfig } from '@shared/network'

export class NetworkService implements IService {
  readonly id = 'network'
  readonly deps = [] as const satisfies readonly ServiceName[]

  // Default values (code constants, not user-configurable)
  private readonly defaultTimeoutMs = 30000
  private readonly defaultRetryCount = 3

  // Domain-based rate limiters (caller-registered)
  private rateLimiters = new Map<string, RateLimiter>()

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  async init(_container: ServiceInitContainer<this>): Promise<void> {
    // Explicitly use system proxy. (This is also Electron's default behavior.)
    await session.defaultSession.setProxy({ mode: 'system' })

    log.info('[NetworkService] Initialized')
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Unified fetch with timeout, retry, and rate limiting.
   * Uses Electron's net.fetch which respects session proxy settings.
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
    const {
      timeout = this.defaultTimeoutMs,
      retries = this.defaultRetryCount,
      rateLimitKey,
      method = 'GET',
      headers,
      body,
      signal
    } = options

    // Apply rate limiting if registered
    if (rateLimitKey) {
      const limiter = this.rateLimiters.get(rateLimitKey)
      if (limiter) {
        await limiter.wait()
      }
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
      method,
      headers,
      body: body as BodyInit
    }

    // Execute with retry
    return this.executeWithRetry(
      () => this.fetchWithTimeout(url, fetchOptions, timeout, signal),
      retries,
      signal
    )
  }

  /**
   * Download content as Buffer
   */
  async downloadBuffer(url: string, options: FetchOptions = {}): Promise<Buffer> {
    const response = await this.fetch(url, options)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  /**
   * Download content to a file via streaming (avoids buffering the full response in memory).
   */
  async downloadToFile(url: string, destPath: string, options: FetchOptions = {}): Promise<void> {
    const retries = options.retries ?? this.defaultRetryCount
    const attemptOptions: FetchOptions = { ...options, retries: 0 }
    const tempPath = path.join(
      path.dirname(destPath),
      `.${path.basename(destPath)}.${randomUUID()}.tmp`
    )

    await this.executeWithRetry(
      async () => {
        assertNotAborted(options.signal)
        await fse.ensureDir(path.dirname(destPath))
        await fse.remove(tempPath).catch(() => undefined)

        const response = await this.fetch(url, attemptOptions)
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
      retries,
      options.signal
    )
  }

  /**
   * Register a rate limiter for a domain key.
   * Callers are responsible for registering their own rate limit configurations.
   */
  registerRateLimit(key: string, config: RateLimitConfig): void {
    this.rateLimiters.set(key, new RateLimiter(config))
    log.debug(
      `[NetworkService] Registered rate limit for '${key}': ${config.maxRequests} requests per ${config.windowMs}ms`
    )
  }

  /**
   * Unregister a rate limiter
   */
  unregisterRateLimit(key: string): void {
    this.rateLimiters.delete(key)
  }

  /**
   * ===========================================================================
   * Private Helpers
   * ===========================================================================
   */

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number,
    signal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController()
    const cleanupAbort = linkAbortSignal(signal, () => controller.abort())
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      assertNotAborted(signal)
      const response = await net.fetch(url, {
        ...options,
        signal: controller.signal
      })
      return response
    } finally {
      clearTimeout(timeoutId)
      cleanupAbort()
    }
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retries: number,
    signal?: AbortSignal
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        assertNotAborted(signal)
        return await fn()
      } catch (error) {
        const currentErrorMessage = error instanceof Error ? error.message : String(error)
        const currentError = error instanceof Error ? error : new Error(String(error))
        lastError = currentError

        // Don't retry aborted requests or deterministic download budget failures.
        if (
          isAbortError(currentError) ||
          isByteLimitExceededError(currentError) ||
          signal?.aborted
        ) {
          throw currentError
        }

        if (attempt < retries) {
          // Exponential backoff: 1s, 2s, 4s, max 10s
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
          log.warn(
            `[NetworkService] Retry ${attempt + 1}/${retries} after ${delay}ms: ${currentErrorMessage}`
          )
          await this.sleep(delay, signal)
        }
      }
    }

    throw lastError
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      assertNotAborted(signal)

      const timeoutId = setTimeout(() => {
        cleanupAbort()
        resolve()
      }, ms)
      const onAbort = () => {
        clearTimeout(timeoutId)
        cleanupAbort()
        reject(createAbortError())
      }
      const cleanupAbort = signal ? linkAbortSignal(signal, onAbort) : () => undefined
    })
  }
}

function isAbortError(error: unknown): error is Error {
  return error instanceof Error && error.name === 'AbortError'
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

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function createAbortError(): Error {
  const error = new Error('Request aborted')
  error.name = 'AbortError'
  return error
}

function linkAbortSignal(signal: AbortSignal | undefined, onAbort: () => void): () => void {
  if (!signal) {
    return () => undefined
  }

  signal.addEventListener('abort', onAbort, { once: true })
  return () => signal.removeEventListener('abort', onAbort)
}

/**
 * Sliding window rate limiter with mutex
 *
 * Allows bursting up to maxRequests, then queues subsequent requests.
 * Uses a mutex to ensure only one request can acquire a slot at a time,
 * preventing the race condition where multiple waiters wake up simultaneously.
 */
class RateLimiter {
  private readonly maxRequests: number
  private readonly windowMs: number
  private requestTimestamps: number[] = []
  private waitQueue: Array<() => void> = []
  private processing = false

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests
    this.windowMs = config.windowMs
  }

  async wait(): Promise<void> {
    // Queue if another request is being processed
    if (this.processing) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve))
    }

    this.processing = true

    try {
      await this.acquireSlot()
    } finally {
      this.processing = false
      // Wake up next waiter in queue
      const next = this.waitQueue.shift()
      if (next) next()
    }
  }

  private async acquireSlot(): Promise<void> {
    while (true) {
      const now = Date.now()
      const windowStart = now - this.windowMs

      // Clean up old timestamps
      this.requestTimestamps = this.requestTimestamps.filter((t) => t > windowStart)

      // If under limit, proceed
      if (this.requestTimestamps.length < this.maxRequests) {
        this.requestTimestamps.push(now)
        return
      }

      // At limit - wait until oldest request exits window
      const oldestTimestamp = this.requestTimestamps[0]
      const waitTime = oldestTimestamp + this.windowMs - now + 1 // +1ms buffer

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }

      // Loop back to re-check (in case timing drift)
    }
  }
}

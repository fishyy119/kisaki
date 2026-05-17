/**
 * Network Types
 *
 * Shared type definitions for the network layer.
 */

/**
 * Network request options
 */
export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: string | Buffer
  signal?: AbortSignal
  /** Timeout in ms (overrides global setting) */
  timeout?: number
  /** Retry count (overrides global setting) */
  retries?: number
  /** Rate limit key (must be registered via NetworkService.rateLimits.register first) */
  rateLimitKey?: string
  /** Maximum number of bytes allowed while streaming a download */
  maxBytes?: number
}

/**
 * Rate limit configuration (sliding window)
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number
  /** Time window in milliseconds */
  windowMs: number
}

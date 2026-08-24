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
  /** Maximum number of bytes allowed while streaming a download */
  maxBytes?: number
}

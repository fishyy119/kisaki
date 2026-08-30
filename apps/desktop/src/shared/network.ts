/**
 * Network Types
 *
 * Shared type definitions for the network layer.
 */

/**
 * Network request options
 */
export interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | undefined
  headers?: Record<string, string> | undefined
  body?: string | Buffer | undefined
  signal?: AbortSignal | undefined
  /** Timeout in ms (overrides global setting) */
  timeout?: number | undefined
  /** Retry count (overrides global setting) */
  retries?: number | undefined
  /** Maximum number of bytes allowed while streaming a download */
  maxBytes?: number | undefined
}

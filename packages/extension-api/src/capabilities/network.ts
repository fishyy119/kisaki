import type { JsonValue } from '../shared'
import type { RpcValue } from '../rpc/core'

export type NetworkMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type NetworkResponseType = 'json' | 'text' | 'arrayBuffer'

export interface NetworkRequest {
  url: string
  method?: NetworkMethod
  headers?: Record<string, string>
  query?: Record<string, string | number | boolean>
  body?: JsonValue | Uint8Array
  timeoutMs?: number
  responseType?: NetworkResponseType
}

export interface NetworkResponse<TData = RpcValue> {
  url: string
  ok: boolean
  status: number
  headers: Record<string, string>
  data: TData
}

export interface NetworkDownloadRequest {
  url: string
  destinationPath?: string
  fileName?: string
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface NetworkDownloadResult {
  filePath: string
  bytesWritten: number
  contentType?: string
}

/**
 * Invocation-scoped options for a single network call.
 *
 * `signal` never crosses the transport: the SDK turns it into the cancellation
 * of the underlying request, which aborts the in-flight fetch or download.
 * Calls made while the host is invoking the extension (a scraper provider, a
 * command, a hook) already inherit that invocation's cancellation, so pass a
 * signal explicitly for work the extension drives itself, such as a task run.
 */
export interface NetworkCallOptions {
  signal?: AbortSignal
}

export interface NetworkCapability {
  request<TData = RpcValue>(
    input: NetworkRequest,
    options?: NetworkCallOptions
  ): Promise<NetworkResponse<TData>>
  download(
    input: NetworkDownloadRequest,
    options?: NetworkCallOptions
  ): Promise<NetworkDownloadResult>
}

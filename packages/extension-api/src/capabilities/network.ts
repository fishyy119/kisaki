import type { JsonValue } from '../shared'
import type { RpcValue } from '../rpc/core'

export type NetworkMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type NetworkResponseType = 'json' | 'text' | 'arrayBuffer'

export interface NetworkRequest {
  url: string
  method?: NetworkMethod | undefined
  headers?: Record<string, string> | undefined
  query?: Record<string, string | number | boolean> | undefined
  body?: JsonValue | Uint8Array | undefined
  timeoutMs?: number | undefined
  responseType?: NetworkResponseType | undefined
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
  destinationPath?: string | undefined
  fileName?: string | undefined
  headers?: Record<string, string> | undefined
  timeoutMs?: number | undefined
}

export interface NetworkDownloadResult {
  filePath: string
  bytesWritten: number
  contentType?: string | undefined
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
  signal?: AbortSignal | undefined
}

export interface NetworkCapability {
  request<TData = RpcValue>(
    input: NetworkRequest,
    options?: NetworkCallOptions | undefined
  ): Promise<NetworkResponse<TData>>
  download(
    input: NetworkDownloadRequest,
    options?: NetworkCallOptions | undefined
  ): Promise<NetworkDownloadResult>
}

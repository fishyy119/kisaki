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

export interface NetworkCapability {
  request<TData = RpcValue>(input: NetworkRequest): Promise<NetworkResponse<TData>>
  download(input: NetworkDownloadRequest): Promise<NetworkDownloadResult>
}

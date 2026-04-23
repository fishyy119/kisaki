import path from 'node:path'
import fse from 'fs-extra'
import type {
  ExtensionRuntimeMetadata,
  NetworkDownloadRequest,
  NetworkDownloadResult,
  NetworkRequest,
  NetworkResponse,
  RpcValue,
  SerializableValue
} from '@kisaki/extension-api'
import {
  createUnavailableError,
  createValidationError,
  normalizeCapabilityError
} from '@kisaki/extension-api'
import type { NetworkService } from '@main/services/network'
import type { FetchOptions } from '@shared/network'

export interface ExtensionNetworkCapabilityHostOptions {
  network: NetworkService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionNetworkCapabilityHost {
  constructor(private readonly options: ExtensionNetworkCapabilityHostOptions) {}

  async request(
    runtimeHandle: string,
    input: NetworkRequest,
    signal?: AbortSignal
  ): Promise<NetworkResponse<RpcValue>> {
    this.requireRuntime(runtimeHandle)

    try {
      const url = buildRequestUrl(input.url, input.query)
      const headers = normalizeHeaders(input.headers) ?? {}
      const body = normalizeRequestBody(input.body, headers)
      const response = await this.options.network.fetch(url, {
        method: input.method,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body,
        timeout: input.timeoutMs,
        signal
      } as FetchOptions)

      return {
        url: response.url,
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: await readResponseBody(response, input.responseType)
      }
    } catch (error) {
      throw normalizeCapabilityError(error, 'The network request failed.')
    }
  }

  async download(
    runtimeHandle: string,
    input: NetworkDownloadRequest,
    signal?: AbortSignal
  ): Promise<NetworkDownloadResult> {
    const metadata = this.requireRuntime(runtimeHandle)
    const destinationPath = resolveDownloadDestination(metadata, input)

    try {
      await this.options.network.downloadToFile(input.url, destinationPath, {
        headers: normalizeHeaders(input.headers),
        timeout: input.timeoutMs,
        signal
      })

      const stats = await fse.stat(destinationPath)
      return {
        filePath: destinationPath,
        bytesWritten: stats.size
      }
    } catch (error) {
      throw normalizeCapabilityError(error, 'The network download failed.')
    }
  }

  private requireRuntime(runtimeHandle: string): ExtensionRuntimeMetadata {
    const metadata = this.options.resolveRuntimeHandle(runtimeHandle)
    if (!metadata) {
      throw createUnavailableError(`Runtime handle "${runtimeHandle}" is not active.`)
    }

    return metadata
  }
}

function buildRequestUrl(
  rawUrl: string,
  query?: Record<string, string | number | boolean>
): string {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw createValidationError('network.request.url must be a non-empty string.')
  }

  const url = new URL(rawUrl)
  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function normalizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      normalized[key] = value
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function normalizeRequestBody(
  body: SerializableValue | Uint8Array | undefined,
  headers: Record<string, string>
): string | Buffer | undefined {
  if (body === undefined) {
    return undefined
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body)
  }

  if (typeof body === 'string') {
    return body
  }

  if (!headers['content-type'] && !headers['Content-Type']) {
    headers['content-type'] = 'application/json'
  }

  return JSON.stringify(body)
}

async function readResponseBody(
  response: Response,
  responseType: NetworkRequest['responseType']
): Promise<RpcValue> {
  switch (responseType ?? 'json') {
    case 'arrayBuffer':
      return new Uint8Array(await response.arrayBuffer())
    case 'text':
      return await response.text()
    case 'json': {
      const data = await response.json()
      return toRpcValue(data)
    }
  }
}

function toRpcValue(value: unknown): RpcValue {
  if (value instanceof Uint8Array) {
    return value
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toRpcValue(entry))
  }

  if (value && typeof value === 'object') {
    const record: Record<string, RpcValue> = {}
    for (const [key, entry] of Object.entries(value)) {
      record[key] = toRpcValue(entry)
    }
    return record
  }

  throw createValidationError('The network response could not be serialized for the extension.')
}

function resolveDownloadDestination(
  metadata: ExtensionRuntimeMetadata,
  input: NetworkDownloadRequest
): string {
  const allowedRoots = [metadata.tempPath, metadata.dataPath]

  if (input.destinationPath) {
    const candidate = path.isAbsolute(input.destinationPath)
      ? path.resolve(input.destinationPath)
      : path.resolve(metadata.tempPath, input.destinationPath)

    assertInsideAllowedRoots(candidate, allowedRoots, 'network.download.destinationPath')
    return candidate
  }

  const preferredName =
    typeof input.fileName === 'string' && input.fileName.trim().length > 0
      ? path.basename(input.fileName)
      : inferFileName(input.url)

  return path.join(metadata.tempPath, preferredName)
}

function inferFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const baseName = path.posix.basename(pathname)
    return baseName && baseName !== '/' ? baseName : 'download'
  } catch {
    return 'download'
  }
}

function assertInsideAllowedRoots(
  candidate: string,
  roots: readonly string[],
  label: string
): void {
  for (const root of roots) {
    const relative = path.relative(path.resolve(root), candidate)
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      return
    }
  }

  throw createValidationError(`${label} must stay within the extension data or temp directory.`)
}

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
import { assertInsideAnyRoot, resolveInsideRoot } from '../shared/path-confinement'

export interface ExtensionNetworkCapabilityProviderOptions {
  network: NetworkService
  resolveRuntimeHandle(runtimeHandle: string): ExtensionRuntimeMetadata | null | undefined
}

export class ExtensionNetworkCapabilityProvider {
  constructor(private readonly options: ExtensionNetworkCapabilityProviderOptions) {}

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
      const response = await this.options.network.request.fetch(url, {
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
      await this.options.network.download.toFile(input.url, destinationPath, {
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
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw createValidationError('network.request.query number values must be finite.')
    }
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

  assertFiniteSerializableValue(body, 'network.request.body')
  return JSON.stringify(body)
}

async function readResponseBody(
  response: Response,
  responseType: NetworkRequest['responseType']
): Promise<RpcValue> {
  if (response.status === 204 || response.status === 205) {
    return null
  }

  switch (responseType) {
    case 'arrayBuffer':
      return new Uint8Array(await response.arrayBuffer())
    case 'text':
      return await response.text()
    case 'json':
      return await readJsonResponseBody(response)
    default:
      return await readDefaultResponseBody(response)
  }
}

async function readDefaultResponseBody(response: Response): Promise<RpcValue> {
  if (isJsonResponse(response)) {
    return await readJsonResponseBody(response)
  }

  const text = await response.text()
  return text.length > 0 ? text : null
}

async function readJsonResponseBody(response: Response): Promise<RpcValue> {
  const text = await response.text()
  if (text.trim().length === 0) {
    return null
  }

  try {
    return toRpcValue(JSON.parse(text))
  } catch {
    throw createValidationError('The network response body is not valid JSON.')
  }
}

function isJsonResponse(response: Response): boolean {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  return (
    contentType.includes('application/json') ||
    contentType.includes('text/json') ||
    /\b[a-z0-9.+-]+\+json\b/.test(contentType)
  )
}

function toRpcValue(value: unknown): RpcValue {
  if (value instanceof Uint8Array) {
    return value
  }

  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw createValidationError('The network response contains a non-finite number.')
    }

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

function assertFiniteSerializableValue(value: SerializableValue, label: string): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw createValidationError(`${label} number values must be finite.`)
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      assertFiniteSerializableValue(entry, label)
    }
    return
  }

  if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) {
      assertFiniteSerializableValue(entry, label)
    }
  }
}

function resolveDownloadDestination(
  metadata: ExtensionRuntimeMetadata,
  input: NetworkDownloadRequest
): string {
  const allowedRoots = [metadata.tempPath, metadata.dataPath]

  if (input.destinationPath !== undefined) {
    if (typeof input.destinationPath !== 'string' || input.destinationPath.trim().length === 0) {
      throw createValidationError('network.download.destinationPath must be a non-empty string.')
    }

    const candidate = path.isAbsolute(input.destinationPath)
      ? path.resolve(input.destinationPath)
      : path.resolve(metadata.tempPath, input.destinationPath)

    assertInsideAnyRoot(candidate, allowedRoots, 'network.download.destinationPath')
    return candidate
  }

  const preferredName =
    input.fileName === undefined
      ? inferFileName(input.url)
      : normalizeDownloadFileName(input.fileName, 'network.download.fileName')
  const candidate = resolveInsideRoot(metadata.tempPath, preferredName)

  assertInsideAnyRoot(candidate, allowedRoots, 'network.download.fileName')
  return candidate
}

function inferFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const baseName = path.posix.basename(pathname)
    return baseName && baseName !== '/'
      ? normalizeDownloadFileName(baseName, 'network.download.url')
      : 'download'
  } catch {
    return 'download'
  }
}

function normalizeDownloadFileName(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw createValidationError(`${label} must be a string.`)
  }

  const fileName = value.trim()
  if (fileName.length === 0 || fileName === '.' || fileName === '..' || /[\\/]/.test(fileName)) {
    throw createValidationError(
      `${label} must be a file name without path separators, "." or "..".`
    )
  }

  return fileName
}

import path from 'node:path'
import { stat } from 'node:fs/promises'
import type {
  ExtensionRuntimeMetadata,
  NetworkDownloadRequest,
  NetworkDownloadResult,
  NetworkMethod,
  NetworkRequest,
  NetworkResponse,
  NetworkResponseType,
  RpcValue,
  JsonValue
} from '@kisaki3/extension-api'
import {
  createUnavailableError,
  createValidationError,
  normalizeCapabilityError,
  toJsonValue
} from '@kisaki3/extension-api'
import type { NetworkService } from '@main/services/network'
import type { FetchOptions } from '@shared/network'
import { assertInsideAnyRoot, resolveInsideRoot } from '@shared/extension/path-confinement'

const NETWORK_METHODS: readonly NetworkMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

const NETWORK_RESPONSE_TYPES: readonly NetworkResponseType[] = ['json', 'text', 'arrayBuffer']

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
      const method = readOptionalEnum(input.method, NETWORK_METHODS, 'network.request.method')
      const responseType = readOptionalEnum(
        input.responseType,
        NETWORK_RESPONSE_TYPES,
        'network.request.responseType'
      )
      const timeoutMs = readOptionalTimeout(input.timeoutMs, 'network.request.timeoutMs')
      const headers = normalizeHeaders(input.headers, 'network.request.headers') ?? {}
      const body = normalizeRequestBody(input.body, headers)
      // `network.request` proxies exactly one HTTP exchange: retry policy
      // (attempt counts, backoff, Retry-After) belongs to the extension, so
      // the host client must not layer its own retries underneath it.
      const response = await this.options.network.request.fetch(url, {
        method,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        body,
        timeout: timeoutMs,
        retries: 0,
        signal
      } as FetchOptions)

      return {
        url: response.url,
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data: await readResponseBody(response, responseType)
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
    if (typeof input.url !== 'string' || input.url.trim().length === 0) {
      throw createValidationError('network.download.url must be a non-empty string.')
    }

    const headers = normalizeHeaders(input.headers, 'network.download.headers')
    const timeoutMs = readOptionalTimeout(input.timeoutMs, 'network.download.timeoutMs')
    const destinationPath = resolveDownloadDestination(metadata, input)

    try {
      await this.options.network.download.toFile(input.url, destinationPath, {
        headers,
        timeout: timeoutMs,
        signal
      })

      const stats = await stat(destinationPath)
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

  if (query !== undefined && !isPlainRecord(query)) {
    throw createValidationError('network.request.query must be an object.')
  }

  const url = new URL(rawUrl)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw createValidationError(
        `network.request.query.${key} must be a string, number, or boolean.`
      )
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw createValidationError(`network.request.query.${key} must be a finite number.`)
    }

    url.searchParams.set(key, String(value))
  }
  return url.toString()
}

function normalizeHeaders(
  headers: Record<string, string> | undefined,
  label: string
): Record<string, string> | undefined {
  if (headers === undefined) {
    return undefined
  }

  if (!isPlainRecord(headers)) {
    throw createValidationError(`${label} must be an object of string values.`)
  }

  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value !== 'string') {
      throw createValidationError(`${label}.${key} must be a string.`)
    }

    normalized[key] = value
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined
}

function readOptionalEnum<T extends string>(
  value: T | undefined,
  allowed: readonly T[],
  label: string
): T | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw createValidationError(`${label} must be one of: ${allowed.join(', ')}.`)
  }

  return value
}

function readOptionalTimeout(value: number | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw createValidationError(`${label} must be a positive number of milliseconds.`)
  }

  return value
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function normalizeRequestBody(
  body: JsonValue | Uint8Array | undefined,
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

  // The RPC channel already canonicalized the body into the JSON model.
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
    return toJsonValue(JSON.parse(text), 'network response body')
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
